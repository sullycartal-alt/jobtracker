import { pgTable, text, serial, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const STATUS_OPTIONS = [
  "En attente",
  "Relancé",
  "Entretien RH",
  "Entretien Technique",
  "Offre reçue",
  "Refusé",
  "Abandonné",
] as const;

export type ApplicationStatus = (typeof STATUS_OPTIONS)[number];

export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  company: text("company").notNull(),
  position: text("position").notNull(),
  location: text("location"),
  contractType: text("contract_type"),
  salary: text("salary"),
  offerUrl: text("offer_url"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  status: text("status").notNull().default("En attente"),
  appliedDate: text("applied_date").notNull(),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  createdAt: true,
});

export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applications.$inferSelect;
