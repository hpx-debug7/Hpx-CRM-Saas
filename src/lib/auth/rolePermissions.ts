import { PERMISSIONS, Permission } from "./permissions";

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: Object.values(PERMISSIONS),

  ADMIN: [
    PERMISSIONS.USER_INVITE,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.LEAD_UPDATE,
  ],

  MEMBER: [
    PERMISSIONS.LEAD_VIEW,
  ],
};
