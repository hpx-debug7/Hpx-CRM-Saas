import { PERMISSIONS, Permission } from "./permissions";

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: [
    ...Object.values(PERMISSIONS),
  ],

  ADMIN: [
    PERMISSIONS.INVITE_USER,
    PERMISSIONS.READ_LEAD,
    PERMISSIONS.CREATE_LEAD,
    PERMISSIONS.UPDATE_LEAD,
  ],

  MEMBER: [
    PERMISSIONS.READ_LEAD,
  ],
};
