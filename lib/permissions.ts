export const PERMISSIONS = {
  // User management
  INVITE_USER: "invite:user",
  REMOVE_USER: "remove:user",

  // Leads
  READ_LEAD: "lead:read",
  CREATE_LEAD: "lead:create",
  UPDATE_LEAD: "lead:update",
  DELETE_LEAD: "lead:delete",

  // Company
  UPDATE_COMPANY: "company:update",
  DELETE_COMPANY: "company:delete",

  // Billing
  MANAGE_BILLING: "billing:manage",
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
