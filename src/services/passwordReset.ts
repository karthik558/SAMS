import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";

// UI hints only. Expiry and throttling are enforced by Supabase Auth configuration.
export const PASSWORD_RESET_MAX_ATTEMPTS = 3;
export const PASSWORD_RESET_CODE_TTL_MINUTES = 10;
type VerifyResult =
  | { status: "ok"; resetToken: string }
  | { status: "resend"; reason?: string };
type RequestResult = { delivered: boolean; maskedEmail: string | null; userFound: boolean };

function requireAuth() {
  if (!hasSupabaseEnv || isDemoMode()) throw new Error("Password recovery unavailable");
}
export function maskEmailAddress(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split("@");
  return domain ? `${local[0] || ""}***@${domain}` : "***";
}
export async function requestPasswordReset(email: string): Promise<RequestResult> {
  requireAuth();
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("Enter your email address");
  // Auth generates, delivers, expires and throttles the recovery token server-side.
  const { error } = await supabase.auth.resetPasswordForEmail(normalized, { redirectTo: `${window.location.origin}/login` });
  if (error) throw new Error("Unable to request recovery. Please try again later.");
  // The same response is used for registered and unregistered addresses.
  return { delivered: true, userFound: true, maskedEmail: maskEmailAddress(normalized) };
}
export async function verifyPasswordResetCode(email: string, code: string): Promise<VerifyResult> {
  requireAuth();
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "recovery" });
  if (error || !data.session) throw new Error("Invalid or expired code. Please retry or request a new code.");
  return { status: "ok", resetToken: data.session.access_token };
}
export async function completePasswordReset(resetToken: string, newPassword: string): Promise<boolean> {
  requireAuth();
  const { data } = await supabase.auth.getSession();
  if (!resetToken || data.session?.access_token !== resetToken) throw new Error("Recovery session expired");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return true;
}
export type PasswordResetVerifyResult = VerifyResult;
export type PasswordResetRequestResult = RequestResult;
