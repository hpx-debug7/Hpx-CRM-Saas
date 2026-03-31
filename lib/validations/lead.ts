import { z } from 'zod';
import { LeadStatus } from '@prisma/client';

export const leadStatusEnum = z.nativeEnum(LeadStatus);

export const createLeadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  status: leadStatusEnum.optional().default(LeadStatus.NEW),
  value: z.union([z.number(), z.string()]).transform((val) => Number(val)).optional().default(0),
  assignedToId: z.string().optional().nullable(),

  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  email: z.string().email("Invalid email format").optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateLeadSchema = createLeadSchema.partial();

export const queryLeadSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: leadStatusEnum.optional(),
  assignedToId: z.string().optional(),
});
