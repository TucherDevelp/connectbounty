import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AuditAction, Json, UserRole } from "@/lib/supabase/types";

/**
 * Server-seitige Auth-Helfer, die alle gegen RLS arbeiten.
 *
 * Faustregel:
 *   • requireUser()      – schlägt fehl, wenn keine Session aktiv ist
 *   • requireRole(role)  – schlägt fehl, wenn die Rolle fehlt
 *   • hasRole(role)      – Boolean, kein Throw
 *
 * Aufrufe gehen über die DB-Function has_role(), damit die Quelle der
 * Wahrheit die SQL-Definition bleibt – nicht eine zweite Code-Implementierung.
 */

export class UnauthenticatedError extends Error {
  constructor() {
    super("Nicht eingeloggt.");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(role: UserRole | UserRole[]) {
    super(`Fehlende Rolle: ${Array.isArray(role) ? role.join("|") : role}`);
    this.name = "ForbiddenError";
  }
}

export class KycRequiredError extends Error {
  constructor() {
    super("Diese Aktion erfordert einen abgeschlossenen KYC.");
    this.name = "KycRequiredError";
  }
}

export async function getCurrentUser() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

export async function hasRole(role: UserRole): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("has_role", { check_role: role });
  if (error) throw error;
  return Boolean(data);
}

export async function hasAnyRole(roles: readonly UserRole[]): Promise<boolean> {
  if (roles.length === 0) return false;
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("has_any_role", {
    check_roles: roles as UserRole[],
  });
  if (error) throw error;
  return Boolean(data);
}

export async function requireRole(role: UserRole) {
  await requireUser();
  if (!(await hasRole(role))) throw new ForbiddenError(role);
}

export async function requireAnyRole(roles: readonly UserRole[]) {
  await requireUser();
  if (!(await hasAnyRole(roles))) throw new ForbiddenError(roles as UserRole[]);
}

/**
 * Prüft via DB-Function is_kyc_approved(), ob der aktuelle User
 * kyc_status='approved' hat. Single Source of Truth bleibt die DB.
 */
export async function isKycApproved(): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("is_kyc_approved", {});
  if (error) throw error;
  return Boolean(data);
}

export async function requireKycApproved() {
  await requireUser();
  if (!(await isKycApproved())) throw new KycRequiredError();
}

/**
 * Triggert das Schreiben eines Audit-Events via SECURITY-DEFINER-Funktion
 * log_audit_event(). Niemals direkt in audit_logs INSERTen, sondern
 * ausschließlich diesen Helper nutzen, damit actor_id konsequent aus der
 * Session abgeleitet wird (Anti-Spoofing).
 */
export async function logAuditEvent(opts: {
  action: AuditAction;
  targetId?: string;
  metadata?: Json;
}): Promise<number> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("log_audit_event", {
    p_action: opts.action,
    p_target: opts.targetId ?? null,
    p_metadata: opts.metadata ?? {},
  });
  if (error) throw error;
  return data as number;
}
