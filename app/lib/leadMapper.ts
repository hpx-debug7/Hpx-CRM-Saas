import type { Lead } from '@/app/types/shared';

type DbLead = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: string | null;
  notes: string | null;
  customFields: string | null;
  assignedToId: string | null;
  createdById: string | null;
};

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toDbLead(input: Lead): DbLead {
  return {
    id: input.id || crypto.randomUUID(),
    firstName: input.clientName || null,
    lastName: null,
    email: null,
    phone: input.mobileNumber || null,
    company: input.company || null,
    source: null,
    status: input.status || 'New',
    notes: input.notes || null,
    customFields: JSON.stringify(input),
    assignedToId: input.assignedTo || null,
    createdById: null
  };
}

export function fromDbLead(dbLead: Record<string, any>): Lead {
  const fallback: Partial<Lead> = {
    id: dbLead.id,
    clientName: dbLead.firstName || '',
    company: dbLead.company || '',
    mobileNumber: dbLead.phone || '',
    status: (dbLead.status as Lead['status']) || 'New',
    notes: dbLead.notes || undefined
  };

  const parsed = safeJsonParse<Partial<Lead>>(dbLead.customFields, {});

  // Normalize common fields to strings for consistent rendering
  const normalized: Partial<Lead> = { ...parsed };
  if (normalized.kva !== undefined && normalized.kva !== null) normalized.kva = String(normalized.kva);
  if (normalized.consumerNumber !== undefined && normalized.consumerNumber !== null) normalized.consumerNumber = String(normalized.consumerNumber);
  if (normalized.company !== undefined && normalized.company !== null) normalized.company = String(normalized.company);
  if (normalized.clientName !== undefined && normalized.clientName !== null) normalized.clientName = String(normalized.clientName);
  if (normalized.mobileNumber !== undefined && normalized.mobileNumber !== null) normalized.mobileNumber = String(normalized.mobileNumber);
  const lead: Lead = {
    kva: '',
    connectionDate: '',
    consumerNumber: '',
    company: '',
    clientName: '',
    mobileNumbers: [],
    mobileNumber: '',
    unitType: 'New',
    status: 'New',
    lastActivityDate: '',
    followUpDate: '',
    isDone: false,
    isDeleted: false,
    isUpdated: false,
    ...fallback,
    ...normalized,
    id: normalized.id || dbLead.id
  } as Lead;

  // Ensure basic fields are present using DB columns as fallback
  if (!lead.clientName && dbLead.firstName) lead.clientName = dbLead.firstName;
  if (!lead.company && dbLead.company) lead.company = dbLead.company;
  if (!lead.mobileNumber && dbLead.phone) lead.mobileNumber = dbLead.phone;

  // Ensure mobileNumbers array exists for UI rendering
  if (!Array.isArray(lead.mobileNumbers)) {
    lead.mobileNumbers = [];
  }
  if (lead.mobileNumbers.length === 0 && lead.mobileNumber) {
    lead.mobileNumbers = [{
      id: '1',
      number: lead.mobileNumber,
      name: lead.clientName || '',
      isMain: true
    }];
  }

  return lead;
}
