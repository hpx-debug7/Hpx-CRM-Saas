import { Prisma } from "@prisma/client";

export function sanitizeCreateLeadInput(input: any, allowedFields: string[] = []): Omit<Prisma.LeadCreateWithoutCompanyInput, "createdBy" | "assignedTo" | "emailThreadLinks"> & { assignedToId?: string | null, createdById?: string | null } {
  // Normalize values
  const sanitized: Record<string, any> = {
    title: input.title?.trim() || null,
    status: input.status,
    value: typeof input.value === 'number' ? input.value : Number(input.value) || 0,
  };

  if (input.description !== undefined) sanitized.description = input.description?.trim() || null;
  if (input.assignedToId !== undefined) sanitized.assignedToId = input.assignedToId || null;
  
  if (input.firstName !== undefined) sanitized.firstName = input.firstName?.trim() || null;
  if (input.lastName !== undefined) sanitized.lastName = input.lastName?.trim() || null;
  if (input.email !== undefined) sanitized.email = input.email?.trim() || null;
  if (input.phone !== undefined) sanitized.phone = input.phone?.trim() || null;
  if (input.companyName !== undefined) sanitized.companyName = input.companyName?.trim() || null;
  if (input.source !== undefined) sanitized.source = input.source?.trim() || null;
  if (input.notes !== undefined) sanitized.notes = input.notes?.trim() || null;

  // Clean undefined
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined) delete sanitized[key];
  });

  // Never allow internal fields
  delete sanitized.companyId;
  delete sanitized.createdById;
  delete sanitized.id;
  delete sanitized.isDeleted;
  delete sanitized.deletedAt;
  delete sanitized.statusUpdatedAt;

  return sanitized as Omit<Prisma.LeadCreateWithoutCompanyInput, "createdBy" | "assignedTo" | "emailThreadLinks"> & { assignedToId?: string | null, createdById?: string | null };
}

export function sanitizeUpdateLeadInput(input: any, existingLead: { status: string }): Prisma.LeadUpdateInput {
  const sanitized: Prisma.LeadUpdateInput = {};

  if (input.title !== undefined) sanitized.title = input.title?.trim() || null;
  if (input.description !== undefined) sanitized.description = input.description?.trim() || null;

  if (input.status !== undefined) {
    sanitized.status = input.status;
    if (input.status !== existingLead.status) {
      sanitized.statusUpdatedAt = new Date();
    }
  }

  if (input.value !== undefined) {
    sanitized.value = typeof input.value === 'number' ? input.value : Number(input.value) || 0;
  }

  if (input.assignedToId !== undefined) {
    sanitized.assignedToId = input.assignedToId || null;
  }
  
  if (input.firstName !== undefined) sanitized.firstName = input.firstName?.trim() || null;
  if (input.lastName !== undefined) sanitized.lastName = input.lastName?.trim() || null;
  if (input.email !== undefined) sanitized.email = input.email?.trim() || null;
  if (input.phone !== undefined) sanitized.phone = input.phone?.trim() || null;
  if (input.companyName !== undefined) sanitized.companyName = input.companyName?.trim() || null;
  if (input.source !== undefined) sanitized.source = input.source?.trim() || null;
  if (input.notes !== undefined) sanitized.notes = input.notes?.trim() || null;

  // Never allow these internal items to be overwritten
  // (In TS, they aren't directly mutable if passed nicely, but if input spread logic occurs, remove keys)
  const safeSanitized = { ...sanitized } as any;
  delete safeSanitized.companyId;
  delete safeSanitized.createdById;
  delete safeSanitized.id;
  delete safeSanitized.isDeleted;
  delete safeSanitized.deletedAt;

  return safeSanitized;
}
