import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, availabilityTable, bookingsTable, complaintsTable, cooperativesTable, profilesTable, reviewsTable, servicesTable, workersTable } from "@workspace/db";

let seedPromise: Promise<void> | undefined;

const seedPromiseFactory = async (): Promise<void> => {
  const existing = await db.select({ id: cooperativesTable.id }).from(cooperativesTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(cooperativesTable).values({
    id: "coop-central",
    name: "Central District Cooperative",
    city: "Bengaluru",
  });

  await db.insert(profilesTable).values([
    { id: "profile-customer", name: "Anika Sharma", email: "anika@coopwork.demo", role: "customer", cooperativeId: "coop-central" },
    { id: "profile-worker-1", name: "Ravi Kumar", email: "ravi@coopwork.demo", role: "worker", cooperativeId: "coop-central" },
    { id: "profile-worker-2", name: "Meera Iyer", email: "meera@coopwork.demo", role: "worker", cooperativeId: "coop-central" },
    { id: "profile-admin", name: "Devika Rao", email: "devika@coopwork.demo", role: "cooperative_admin", cooperativeId: "coop-central" },
  ]);

  await db.insert(servicesTable).values([
    { id: "service-electrician", name: "Electrician", description: "Wiring, repairs, and safe electrical work." },
    { id: "service-plumber", name: "Plumber", description: "Leaks, fittings, drainage, and water systems." },
    { id: "service-carpenter", name: "Carpenter", description: "Furniture repairs, woodwork, and installations." },
    { id: "service-cleaner", name: "Cleaner", description: "Reliable home and office cleaning." },
  ]);

  await db.insert(workersTable).values([
    { id: "worker-ravi", profileId: "profile-worker-1", serviceId: "service-electrician", cooperativeId: "coop-central", experience: "8 years", rating: "4.9", availability: "Available", verified: true, enabled: true, location: "Indiranagar", jobsCompleted: "124", initials: "RK" },
    { id: "worker-meera", profileId: "profile-worker-2", serviceId: "service-plumber", cooperativeId: "coop-central", experience: "5 years", rating: "4.7", availability: "Busy", verified: true, enabled: true, location: "Koramangala", jobsCompleted: "86", initials: "MI" },
  ]);

  await db.insert(availabilityTable).values([
    { workerId: "worker-ravi", available: true, days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], startTime: "09:00", endTime: "18:00" },
    { workerId: "worker-meera", available: true, days: ["Monday", "Wednesday", "Saturday"], startTime: "10:00", endTime: "17:00" },
  ]);

  await db.insert(bookingsTable).values([
    { id: "booking-1001", customerId: "profile-customer", workerId: "worker-ravi", serviceId: "service-electrician", date: "2026-09-12", time: "10:30", address: "14th Main, Indiranagar", description: "Ceiling fan is making a clicking sound.", status: "accepted", amount: "850" },
    { id: "booking-1002", customerId: "profile-customer", workerId: "worker-meera", serviceId: "service-plumber", date: "2026-09-15", time: "15:00", address: "5th Block, Koramangala", description: "Kitchen sink tap is leaking.", status: "pending", amount: "650" },
    { id: "booking-0998", customerId: "profile-customer", workerId: "worker-ravi", serviceId: "service-electrician", date: "2026-08-30", time: "11:00", address: "12th Cross, Indiranagar", description: "Replaced two damaged sockets.", status: "completed", amount: "1200" },
  ]);

  await db.insert(reviewsTable).values([
    { id: "review-1", reviewerId: "profile-customer", subject: "Ravi Kumar", rating: "5", comment: "Arrived on time and explained everything clearly.", date: "2026-08-30" },
    { id: "review-2", reviewerId: "profile-customer", subject: "Meera Iyer", rating: "4.5", comment: "Careful work and tidy finish.", date: "2026-08-15" },
  ]);

  await db.insert(complaintsTable).values([
    { id: "complaint-1", customerId: "profile-customer", subject: "Follow-up on completed repair", description: "Would like an invoice copy for my records.", status: "in_review" },
  ]);
};

export const ensureSeedData = async (): Promise<void> => {
  seedPromise ??= seedPromiseFactory();
  await seedPromise;
};

export const roleProfiles = {
  customer: { id: "profile-customer", name: "Anika Sharma", email: "anika@coopwork.demo", cooperativeId: "coop-central" },
  worker: { id: "profile-worker-1", name: "Ravi Kumar", email: "ravi@coopwork.demo", cooperativeId: "coop-central" },
  cooperative_admin: { id: "profile-admin", name: "Devika Rao", email: "devika@coopwork.demo", cooperativeId: "coop-central" },
} as const;

export type CoopRole = keyof typeof roleProfiles;

const workerProfiles = alias(profilesTable, "worker_profiles");

export const parseRole = (raw: unknown): CoopRole => {
  if (raw === "worker" || raw === "cooperative_admin" || raw === "customer") return raw;
  return "customer";
};

export const bookingRows = async () =>
  db
    .select({
      id: bookingsTable.id,
      customerName: profilesTable.name,
      workerName: workerProfiles.name,
      service: servicesTable.name,
      date: bookingsTable.date,
      time: bookingsTable.time,
      address: bookingsTable.address,
      description: bookingsTable.description,
      status: bookingsTable.status,
      amount: bookingsTable.amount,
      customerId: bookingsTable.customerId,
      workerId: bookingsTable.workerId,
    })
    .from(bookingsTable)
    .innerJoin(profilesTable, eq(bookingsTable.customerId, profilesTable.id))
    .innerJoin(workersTable, eq(bookingsTable.workerId, workersTable.id))
    .innerJoin(workerProfiles, eq(workersTable.profileId, workerProfiles.id))
    .innerJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
    .orderBy(asc(bookingsTable.date));

export const workerRows = async () =>
  db
    .select({
      id: workersTable.id,
      name: profilesTable.name,
      skill: servicesTable.name,
      rating: workersTable.rating,
      experience: workersTable.experience,
      availability: workersTable.availability,
      verified: workersTable.verified,
      location: workersTable.location,
      jobsCompleted: workersTable.jobsCompleted,
      initials: workersTable.initials,
      enabled: workersTable.enabled,
    })
    .from(workersTable)
    .innerJoin(profilesTable, eq(workersTable.profileId, profilesTable.id))
    .innerJoin(servicesTable, eq(workersTable.serviceId, servicesTable.id))
    .where(eq(workersTable.enabled, true))
    .orderBy(asc(profilesTable.name));

export const availabilityForWorker = async (workerId: string) => {
  const [row] = await db.select().from(availabilityTable).where(eq(availabilityTable.workerId, workerId));
  return row;
};

export const findWorker = async (workerId: string) => {
  const [row] = await db.select().from(workersTable).where(eq(workersTable.id, workerId));
  return row;
};

export const findService = async (serviceName: string) => {
  const [row] = await db.select().from(servicesTable).where(eq(servicesTable.name, serviceName));
  return row;
};

export const profileForRole = (role: CoopRole) => roleProfiles[role];