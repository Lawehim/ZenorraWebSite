import type { Role } from "@prisma/client";

/** The authenticated staff member performing an action. */
export interface Actor {
  id: string;
  role: Role;
  email?: string;
  name?: string;
}

export interface RequestCtx {
  ip?: string;
  userAgent?: string;
  now?: Date;
}
