/**
 * Database-Typen für ConnectBounty – Schema v1.
 *
 * Diese Datei spiegelt 1:1 supabase/migrations/0001_init_auth.sql.
 * Nach jeder neuen Migration wird sie ab Phase 1.2 mit der Supabase CLI
 * regeneriert:
 *
 *   export SUPABASE_ACCESS_TOKEN=...
 *   npx supabase gen types typescript \
 *     --project-id gggovrqckwhjqipfoetu \
 *     --schema public > lib/supabase/types.ts
 *
 * Bis dahin gilt: SQL-Migration und dieser Typ müssen synchron bleiben.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole =
  | "guest"
  | "registered_user"
  | "verified_user"
  | "moderator"
  | "kyc_reviewer"
  | "support"
  | "admin"
  | "superadmin";

export type KycStatus = "unverified" | "pending" | "approved" | "rejected" | "expired";

export type AuditAction =
  | "user.signup"
  | "user.login"
  | "user.logout"
  | "user.profile_update"
  | "user.email_change"
  | "user.password_change"
  | "user.role_grant"
  | "user.role_revoke"
  | "kyc.submitted"
  | "kyc.approved"
  | "kyc.rejected"
  | "kyc.expired"
  | "listing.created"
  | "listing.updated"
  | "listing.deleted"
  | "listing.moderated"
  | "chat.reported"
  | "chat.message_blocked"
  | "payout.requested"
  | "payout.released"
  | "payout.failed"
  | "admin.action";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          locale: string;
          kyc_status: KycStatus;
          email_verified_at: string | null;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          locale?: string;
          kyc_status?: KycStatus;
          email_verified_at?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          locale?: string;
          kyc_status?: KycStatus;
          email_verified_at?: string | null;
          last_seen_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: UserRole;
          granted_by: string | null;
          granted_at: string;
          expires_at: string | null;
        };
        Insert: {
          user_id: string;
          role: UserRole;
          granted_by?: string | null;
          granted_at?: string;
          expires_at?: string | null;
        };
        Update: {
          user_id?: string;
          role?: UserRole;
          granted_by?: string | null;
          granted_at?: string;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      kyc_applicants: {
        Row: {
          id: string;
          user_id: string;
          applicant_id: string;
          level_name: string;
          status: KycStatus;
          review_result: Json | null;
          reject_labels: string[] | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          applicant_id: string;
          level_name: string;
          status?: KycStatus;
          review_result?: Json | null;
          reject_labels?: string[] | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          applicant_id?: string;
          level_name?: string;
          status?: KycStatus;
          review_result?: Json | null;
          reject_labels?: string[] | null;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kyc_applicants_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          target_id: string | null;
          action: AuditAction;
          metadata: Json;
          ip: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          target_id?: string | null;
          action: AuditAction;
          metadata?: Json;
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          target_id?: string | null;
          action?: AuditAction;
          metadata?: Json;
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_role: {
        Args: { check_role: UserRole };
        Returns: boolean;
      };
      has_any_role: {
        Args: { check_roles: UserRole[] };
        Returns: boolean;
      };
      log_audit_event: {
        Args: {
          p_action: AuditAction;
          p_target?: string | null;
          p_metadata?: Json;
        };
        Returns: number;
      };
      update_kyc_status: {
        Args: {
          p_applicant_id: string;
          p_status: KycStatus;
          p_review_result?: Json | null;
          p_reject_labels?: string[] | null;
        };
        Returns: void;
      };
    };
    Enums: {
      user_role: UserRole;
      kyc_status: KycStatus;
      audit_action: AuditAction;
    };
    CompositeTypes: Record<string, never>;
  };
};
