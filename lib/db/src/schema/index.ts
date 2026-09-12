import {
  boolean,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const cooperativesTable = pgTable("cooperatives", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
});

export const profilesTable = pgTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  cooperativeId: text("cooperative_id").references(() => cooperativesTable.id),
});

export const servicesTable = pgTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
});

export const workersTable = pgTable("workers", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => profilesTable.id),
  serviceId: text("service_id").notNull().references(() => servicesTable.id),
  cooperativeId: text("cooperative_id").notNull().references(() => cooperativesTable.id),
  experience: text("experience").notNull(),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull(),
  availability: text("availability").notNull(),
  verified: boolean("verified").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  location: text("location").notNull(),
  jobsCompleted: numeric("jobs_completed").notNull().default("0"),
  initials: text("initials").notNull(),
});

export const bookingsTable = pgTable("bookings", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => profilesTable.id),
  workerId: text("worker_id").notNull().references(() => workersTable.id),
  serviceId: text("service_id").notNull().references(() => servicesTable.id),
  date: text("date").notNull(),
  time: text("time").notNull(),
  address: text("address").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const availabilityTable = pgTable("availability", {
  workerId: text("worker_id").primaryKey().references(() => workersTable.id),
  available: boolean("available").notNull().default(true),
  days: text("days").array().notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
});

export const reviewsTable = pgTable("reviews", {
  id: text("id").primaryKey(),
  reviewerId: text("reviewer_id").notNull().references(() => profilesTable.id),
  subject: text("subject").notNull(),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull(),
  comment: text("comment").notNull(),
  date: text("date").notNull(),
});

export const paymentsTable = pgTable("payments", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => bookingsTable.id),
  customerId: text("customer_id").notNull().references(() => profilesTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(),
});

export const complaintsTable = pgTable("complaints", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => profilesTable.id),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});