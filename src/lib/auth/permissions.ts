export const PERMISSIONS = {
  USER_INVITE: "user.invite",
  USER_VIEW: "user.view",
  USER_DELETE: "user.delete",

  LEAD_CREATE: "lead.create",
  LEAD_VIEW: "lead.view",
  LEAD_UPDATE: "lead.update",
  LEAD_DELETE: "lead.delete",

  COMPANY_UPDATE: "company.update",
  BILLING_UPDATE: "billing.update",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
