import { Lead } from "@prisma/client";

export function buildLeadAuditPayload(lead: Lead) {
  return {
    id: lead.id,
    title: lead.title,
    status: lead.status,
    value: lead.value,
    assignedToId: lead.assignedToId
  };
}
