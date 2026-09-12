import { Router, type IRouter } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db, availabilityTable, bookingsTable, complaintsTable, reviewsTable, workersTable } from "@workspace/db";
import {
  CreateBookingBody,
  CreateComplaintBody,
  GetDashboardSummaryQueryParams,
  ListBookingsQueryParams,
  ListWorkersQueryParams,
  UpdateAvailabilityBody,
  UpdateBookingStatusBody,
  UpdateBookingStatusParams,
  UpdateWorkerVerificationBody,
  UpdateWorkerVerificationParams,
} from "@workspace/api-zod";
import {
  availabilityForWorker,
  bookingRows,
  ensureSeedData,
  findService,
  findWorker,
  parseRole,
  profileForRole,
  roleProfiles,
  workerRows,
  type CoopRole,
} from "../lib/coopwork-data";

const router: IRouter = Router();

const normalizeBooking = (row: Awaited<ReturnType<typeof bookingRows>>[number]) => ({
  id: row.id,
  customerName: row.customerName,
  workerName: row.workerName,
  service: row.service,
  date: row.date,
  time: row.time,
  address: row.address,
  description: row.description,
  status: row.status,
  amount: Number(row.amount),
});

const metricsFor = (role: CoopRole, bookings: ReturnType<typeof normalizeBooking>[], workers: Awaited<ReturnType<typeof workerRows>>) => {
  if (role === "customer") {
    return [
      { label: "Total bookings", value: String(bookings.length), detail: "All time", tone: "blue" as const },
      { label: "Active bookings", value: String(bookings.filter((booking) => ["accepted", "in_progress"].includes(booking.status)).length), detail: "Currently moving", tone: "green" as const },
      { label: "Completed", value: String(bookings.filter((booking) => booking.status === "completed").length), detail: "Services finished", tone: "purple" as const },
      { label: "Pending", value: String(bookings.filter((booking) => booking.status === "pending").length), detail: "Awaiting response", tone: "orange" as const },
    ];
  }

  if (role === "worker") {
    return [
      { label: "Pending requests", value: String(bookings.filter((booking) => booking.status === "pending").length), detail: "Need your response", tone: "orange" as const },
      { label: "Active jobs", value: String(bookings.filter((booking) => ["accepted", "in_progress"].includes(booking.status)).length), detail: "On your schedule", tone: "blue" as const },
      { label: "Completed jobs", value: String(bookings.filter((booking) => booking.status === "completed").length), detail: "This cooperative", tone: "green" as const },
      { label: "Total earnings", value: `₹${bookings.filter((booking) => booking.status === "completed").reduce((sum, booking) => sum + booking.amount, 0).toLocaleString("en-IN")}`, detail: "From completed jobs", tone: "purple" as const },
    ];
  }

  return [
    { label: "Total workers", value: String(workers.length), detail: "In your cooperative", tone: "blue" as const },
    { label: "Total customers", value: "24", detail: "Active members", tone: "green" as const },
    { label: "Total bookings", value: String(bookings.length), detail: "All services", tone: "purple" as const },
    { label: "Pending complaints", value: "1", detail: "Needs review", tone: "orange" as const },
  ];
};

router.use(async (_req, _res, next) => {
  await ensureSeedData();
  next();
});

router.get("/session", (_req, res): void => {
  const role = parseRole(_req.query.role);
  const profile = profileForRole(role);
  res.json({ userId: profile.id, name: profile.name, email: profile.email, role, cooperativeId: profile.cooperativeId });
});

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const parsed = GetDashboardSummaryQueryParams.safeParse(req.query);
  const role = parseRole(parsed.success ? parsed.data.role : req.query.role);
  const rows = (await bookingRows()).map(normalizeBooking);
  const workers = await workerRows();
  const visibleBookings = role === "customer"
    ? rows.filter((booking) => booking.customerName === roleProfiles.customer.name)
    : role === "worker"
      ? rows.filter((booking) => booking.workerName === roleProfiles.worker.name)
      : rows;
  res.json({ role, metrics: metricsFor(role, visibleBookings, workers), recentBookings: visibleBookings.slice(-4).reverse() });
});

router.get("/bookings", async (req, res): Promise<void> => {
  const parsed = ListBookingsQueryParams.safeParse(req.query);
  const role = parseRole(parsed.success ? parsed.data.role : req.query.role);
  const status = parsed.success ? parsed.data.status : undefined;
  const rows = (await bookingRows()).map(normalizeBooking);
  const visible = role === "customer"
    ? rows.filter((booking) => booking.customerName === roleProfiles.customer.name)
    : role === "worker"
      ? rows.filter((booking) => booking.workerName === roleProfiles.worker.name)
      : rows;
  res.json(status ? visible.filter((booking) => booking.status === status) : visible);
});

router.post("/bookings", async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const worker = await findWorker(parsed.data.workerId);
  const service = await findService(parsed.data.service);
  if (!worker || !service) {
    res.status(404).json({ error: "Worker or service not found" });
    return;
  }
  const bookingId = `booking-${Date.now()}`;
  await db.insert(bookingsTable).values({
    id: bookingId,
    customerId: roleProfiles.customer.id,
    workerId: worker.id,
    serviceId: service.id,
    date: parsed.data.date,
    time: parsed.data.time,
    address: parsed.data.address,
    description: parsed.data.description,
    status: "pending",
    amount: "750",
  });
  const created = (await bookingRows()).find((booking) => booking.id === bookingId);
  res.status(201).json(normalizeBooking(created!));
});

router.patch("/bookings/:bookingId/status", async (req, res): Promise<void> => {
  const params = UpdateBookingStatusParams.safeParse(req.params);
  const body = UpdateBookingStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid booking status request" });
    return;
  }
  await db.update(bookingsTable).set({ status: body.data.status }).where(eq(bookingsTable.id, params.data.bookingId));
  const updated = (await bookingRows()).find((booking) => booking.id === params.data.bookingId);
  if (!updated) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  res.json(normalizeBooking(updated));
});

router.get("/workers", async (req, res): Promise<void> => {
  const parsed = ListWorkersQueryParams.safeParse(req.query);
  const filters = parsed.success ? parsed.data : {};
  const workers = await workerRows();
  const filtered = workers.filter((worker) => (
    (!filters.service || worker.skill === filters.service) &&
    (!filters.availability || worker.availability === filters.availability) &&
    (filters.minRating == null || Number(worker.rating) >= filters.minRating)
  ));
  res.json(filtered.map((worker) => ({ ...worker, rating: Number(worker.rating), jobsCompleted: Number(worker.jobsCompleted) })));
});

router.get("/availability", async (_req, res): Promise<void> => {
  const availability = await availabilityForWorker("worker-ravi");
  res.json(availability ?? { available: true, days: [], startTime: "09:00", endTime: "18:00" });
});

router.put("/availability", async (req, res): Promise<void> => {
  const parsed = UpdateAvailabilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const actualWorkerId = "worker-ravi";
  await db.insert(availabilityTable).values({ workerId: actualWorkerId, ...parsed.data }).onConflictDoUpdate({
    target: availabilityTable.workerId,
    set: parsed.data,
  });
  res.json(parsed.data);
});

router.get("/reviews", async (_req, res): Promise<void> => {
  const reviews = await db.select().from(reviewsTable).orderBy(desc(reviewsTable.date));
  res.json(reviews.map((review) => ({ id: review.id, reviewer: roleProfiles.customer.name, subject: review.subject, rating: Number(review.rating), comment: review.comment, date: review.date })));
});

router.get("/complaints", async (_req, res): Promise<void> => {
  const complaints = await db.select().from(complaintsTable).orderBy(desc(complaintsTable.createdAt));
  res.json(complaints.map((complaint) => ({ id: complaint.id, subject: complaint.subject, description: complaint.description, status: complaint.status, createdAt: complaint.createdAt.toISOString() })));
});

router.post("/complaints", async (req, res): Promise<void> => {
  const parsed = CreateComplaintBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const id = `complaint-${Date.now()}`;
  const [complaint] = await db.insert(complaintsTable).values({ id, customerId: roleProfiles.customer.id, subject: parsed.data.subject, description: parsed.data.description, status: "open" }).returning();
  res.status(201).json({ id: complaint.id, subject: complaint.subject, description: complaint.description, status: complaint.status, createdAt: complaint.createdAt.toISOString() });
});

router.get("/admin/workers", async (_req, res): Promise<void> => {
  const rows = await workerRows();
  res.json(rows.map((worker) => ({ ...worker, rating: Number(worker.rating), jobsCompleted: Number(worker.jobsCompleted) })));
});

router.patch("/admin/workers/:workerId/verification", async (req, res): Promise<void> => {
  const params = UpdateWorkerVerificationParams.safeParse(req.params);
  const body = UpdateWorkerVerificationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid worker verification request" });
    return;
  }
  await db.update(workersTable).set({ verified: body.data.verified, enabled: body.data.enabled }).where(eq(workersTable.id, params.data.workerId));
  const updated = (await workerRows()).find((worker) => worker.id === params.data.workerId);
  if (!updated) {
    res.status(404).json({ error: "Worker not found" });
    return;
  }
  res.json({ ...updated, rating: Number(updated.rating), jobsCompleted: Number(updated.jobsCompleted) });
});

export default router;