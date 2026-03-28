// User types from auth session
export interface PortalUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "ROOT_ADMIN" | "TENANT_ADMIN" | "MEMBER";
  tenantId: number;
}

// Status constants
export const UserStatus = {
  INVITED: "INVITED",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED"
} as const;
export type UserStatusType = typeof UserStatus[keyof typeof UserStatus];

export const WorkspaceStatus = {
  STOPPED: "STOPPED",
  STARTING: "STARTING",
  PREPARING: "PREPARING",
  INITIALIZING: "INITIALIZING",
  SPAWNING: "SPAWNING",
  RUNNING: "RUNNING",
  STOPPING: "STOPPING",
  ERROR: "ERROR",
  EXPIRED: "EXPIRED"
} as const;
export type WorkspaceStatusType = typeof WorkspaceStatus[keyof typeof WorkspaceStatus];

export const UserRole = {
  ROOT_ADMIN: "ROOT_ADMIN",
  TENANT_ADMIN: "TENANT_ADMIN",
  MEMBER: "MEMBER"
} as const;
export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export const ADMIN_ROLES: readonly string[] = [UserRole.ROOT_ADMIN, UserRole.TENANT_ADMIN];

// Session constants
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60; // 24 hours

// Rate limit constants
export const RATE_LIMIT = {
  AUTH_LOGIN: { limit: 10, windowMs: 15 * 60 * 1000 },
  AUTH_REGISTER: { limit: 5, windowMs: 15 * 60 * 1000 },
  PASSWORD_RESET: { limit: 3, windowMs: 15 * 60 * 1000 }
} as const;
