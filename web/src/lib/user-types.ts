export type UserRole = "superadmin" | "user";
export type UserStatus = "invited" | "active" | "disabled";
export type CreditReason = "invite_grant" | "admin_adjust" | "generation" | "refund";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  credits: number;
  createdAt: string | null;
  lastLoginAt: string | null;
  inviteExpiresAt: string | null;
};

export type LedgerEntry = {
  id: string;
  userId: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  jobId: string;
  note: string;
  createdBy: string;
  createdAt: string | null;
};
