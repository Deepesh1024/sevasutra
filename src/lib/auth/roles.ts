import type { User } from "@prisma/client";

/**
 * Verified applicant = phone verified by OTP, or (when EMAIL_OTP_GRANTS_APPLICANT is on) signed in with an
 * email OTP, which sets role "applicant". Google sign-in alone never grants this; neither does verifying an
 * email address for reminders.
 */
export function isApplicant(user: Pick<User, "phoneVerifiedAt" | "role"> | null | undefined): boolean {
  if (!user) return false;
  if (user.phoneVerifiedAt) return true;
  return user.role === "applicant" || user.role === "admin" || user.role === "support";
}
