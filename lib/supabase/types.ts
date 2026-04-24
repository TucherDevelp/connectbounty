/**
 * Database-Typen für ConnectBounty - Schema v1.
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
  | "bounty.created"
  | "bounty.published"
  | "bounty.updated"
  | "bounty.closed"
  | "bounty.cancelled"
  | "bounty.deleted"
  | "referral.submitted"
  | "referral.status_changed"
  | "referral.withdrawn"
  | "bounty.expired"
  | "chat.reported"
  | "chat.message_blocked"
  | "payout.created"
  | "payout.processing"
  | "payout.paid"
  | "payout.requested"
  | "payout.released"
  | "payout.failed"
  | "stripe.connect_started"
  | "stripe.connect_completed"
  | "stripe.connect_revoked"
  | "admin.action"
  | "bounty.approved"
  | "bounty.rejected"
  | "referral.approved"
  | "referral.deleted"
  // v7 - Three-stage confirmation + split payout
  | "referral.hire_proof_uploaded"
  | "referral.claim_confirmed"
  | "referral.payout_account_confirmed"
  | "referral.data_forwarded"
  | "referral.confirmation_rejected"
  | "referral.dispute_opened"
  | "referral.dispute_resolved"
  | "payout.invoice_created"
  | "payout.invoice_paid"
  | "payout.transfers_dispatched"
  | "payout.completed"
  | "reminder.sent";

export type BountyStatus = "draft" | "pending_review" | "open" | "closed" | "expired" | "cancelled";

export type BountyPaymentMode = "on_confirmation" | "escrow";

export type PayoutStatus = "pending" | "processing" | "paid" | "failed" | "cancelled";

export type PayoutCaptureMethod = "automatic" | "manual";

export type ReferralStatus =
  // Legacy-Flow
  | "pending_review"
  | "submitted"
  | "contacted"
  | "interviewing"
  | "hired"
  | "paid"
  | "rejected"
  | "withdrawn"
  // v7 - Three-stage confirmation flow
  | "awaiting_hire_proof"
  | "awaiting_claim"
  | "awaiting_payout_account"
  | "awaiting_data_forwarding"
  | "invoice_pending"
  | "invoice_paid"
  | "disputed";

export type RejectionStage =
  | "hire_proof"
  | "claim"
  | "payout_account"
  | "data_forwarding";

export type DisputeStatus = "open" | "resolved" | "dismissed";

export type ReputationEventType =
  | "paid_on_time"
  | "paid_late"
  | "failed"
  | "disputed_against"
  | "dispute_won";

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
          referrer_id: string | null;
          referral_code: string | null;
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
          referrer_id?: string | null;
          referral_code?: string | null;
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
          referrer_id?: string | null;
          referral_code?: string | null;
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
      kyc_documents: {
        Row: {
          id: string;
          applicant_id: string;
          user_id: string;
          document_type: "id_card_front" | "id_card_back" | "passport" | "selfie";
          storage_path: string;
          file_size: number | null;
          mime_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          applicant_id: string;
          user_id: string;
          document_type: "id_card_front" | "id_card_back" | "passport" | "selfie";
          storage_path: string;
          file_size?: number | null;
          mime_type?: string | null;
          created_at?: string;
        };
        Update: {
          document_type?: "id_card_front" | "id_card_back" | "passport" | "selfie";
          storage_path?: string;
          file_size?: number | null;
          mime_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "kyc_documents_applicant_id_fkey";
            columns: ["applicant_id"];
            referencedRelation: "kyc_applicants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kyc_documents_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bounties: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string;
          bonus_amount: number;
          bonus_currency: string;
          location: string | null;
          industry: string | null;
          tags: string[];
          status: BountyStatus;
          expires_at: string | null;
          published_at: string | null;
          closed_at: string | null;
          split_referrer_bps: number;
          split_candidate_bps: number;
          split_platform_bps: number;
          payment_mode: BountyPaymentMode;
          escrow_payment_intent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          description: string;
          bonus_amount: number;
          bonus_currency?: string;
          location?: string | null;
          industry?: string | null;
          tags?: string[];
          status?: BountyStatus;
          expires_at?: string | null;
          published_at?: string | null;
          closed_at?: string | null;
          split_referrer_bps?: number;
          split_candidate_bps?: number;
          split_platform_bps?: number;
          payment_mode?: BountyPaymentMode;
          escrow_payment_intent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          description?: string;
          bonus_amount?: number;
          bonus_currency?: string;
          location?: string | null;
          industry?: string | null;
          tags?: string[];
          status?: BountyStatus;
          expires_at?: string | null;
          published_at?: string | null;
          closed_at?: string | null;
          split_referrer_bps?: number;
          split_candidate_bps?: number;
          split_platform_bps?: number;
          payment_mode?: BountyPaymentMode;
          escrow_payment_intent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bounties_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bounty_referrals: {
        Row: {
          id: string;
          bounty_id: string;
          referrer_id: string;
          candidate_name: string;
          candidate_email: string;
          candidate_contact: string | null;
          message: string | null;
          status: ReferralStatus;
          status_changed_at: string;
          status_changed_by: string | null;
          hired_at: string | null;
          paid_at: string | null;
          // v7 fields
          candidate_user_id: string | null;
          hire_proof_uploaded_at: string | null;
          claim_confirmed_at: string | null;
          claim_confirmed_by: string | null;
          payout_account_confirmed_at: string | null;
          payout_account_confirmed_by: string | null;
          company_billing_id: string | null;
          company_name: string | null;
          company_billing_email: string | null;
          company_billing_address: Json | null;
          company_tax_id: string | null;
          data_forwarded_at: string | null;
          data_forwarded_by: string | null;
          payment_window_until: string | null;
          rejection_reason: string | null;
          rejection_stage: RejectionStage | null;
          rejection_at: string | null;
          rejection_by: string | null;
          all_confirmations_done: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bounty_id: string;
          referrer_id: string;
          candidate_name: string;
          candidate_email: string;
          candidate_contact?: string | null;
          message?: string | null;
          status?: ReferralStatus;
          status_changed_at?: string;
          status_changed_by?: string | null;
          hired_at?: string | null;
          paid_at?: string | null;
          candidate_user_id?: string | null;
          hire_proof_uploaded_at?: string | null;
          claim_confirmed_at?: string | null;
          claim_confirmed_by?: string | null;
          payout_account_confirmed_at?: string | null;
          payout_account_confirmed_by?: string | null;
          company_billing_id?: string | null;
          company_name?: string | null;
          company_billing_email?: string | null;
          company_billing_address?: Json | null;
          company_tax_id?: string | null;
          data_forwarded_at?: string | null;
          data_forwarded_by?: string | null;
          payment_window_until?: string | null;
          rejection_reason?: string | null;
          rejection_stage?: RejectionStage | null;
          rejection_at?: string | null;
          rejection_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          bounty_id?: string;
          referrer_id?: string;
          candidate_name?: string;
          candidate_email?: string;
          candidate_contact?: string | null;
          message?: string | null;
          status?: ReferralStatus;
          status_changed_at?: string;
          status_changed_by?: string | null;
          hired_at?: string | null;
          paid_at?: string | null;
          candidate_user_id?: string | null;
          hire_proof_uploaded_at?: string | null;
          claim_confirmed_at?: string | null;
          claim_confirmed_by?: string | null;
          payout_account_confirmed_at?: string | null;
          payout_account_confirmed_by?: string | null;
          company_billing_id?: string | null;
          company_name?: string | null;
          company_billing_email?: string | null;
          company_billing_address?: Json | null;
          company_tax_id?: string | null;
          data_forwarded_at?: string | null;
          data_forwarded_by?: string | null;
          payment_window_until?: string | null;
          rejection_reason?: string | null;
          rejection_stage?: RejectionStage | null;
          rejection_at?: string | null;
          rejection_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bounty_referrals_bounty_id_fkey";
            columns: ["bounty_id"];
            referencedRelation: "bounties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bounty_referrals_referrer_id_fkey";
            columns: ["referrer_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_connect_accounts: {
        Row: {
          id: string;
          user_id: string;
          stripe_account_id: string | null;
          onboarding_status: "pending" | "onboarding" | "active" | "restricted" | "disabled";
          payouts_enabled: boolean;
          charges_enabled: boolean;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_account_id?: string | null;
          onboarding_status?: "pending" | "onboarding" | "active" | "restricted" | "disabled";
          payouts_enabled?: boolean;
          charges_enabled?: boolean;
          last_synced_at?: string | null;
        };
        Update: {
          stripe_account_id?: string | null;
          onboarding_status?: "pending" | "onboarding" | "active" | "restricted" | "disabled";
          payouts_enabled?: boolean;
          charges_enabled?: boolean;
          last_synced_at?: string | null;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "stripe_connect_accounts_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"]; }];
      };
      payouts: {
        Row: {
          id: string;
          referral_id: string;
          bounty_id: string;
          referrer_id: string;
          stripe_account_id: string | null;
          amount: number;
          currency: string;
          status: PayoutStatus;
          stripe_transfer_id: string | null;
          stripe_error_code: string | null;
          failure_reason: string | null;
          requested_at: string;
          processing_started_at: string | null;
          paid_at: string | null;
          failed_at: string | null;
          cancelled_at: string | null;
          // v7 split payout fields
          payment_intent_id: string | null;
          invoice_id: string | null;
          invoice_hosted_url: string | null;
          transfer_group: string | null;
          total_cents: number | null;
          amount_referrer_cents: number | null;
          amount_candidate_cents: number | null;
          amount_ref_of_a_cents: number | null;
          amount_ref_of_b_cents: number | null;
          amount_platform_fee_cents: number | null;
          referrer_transfer_id: string | null;
          candidate_transfer_id: string | null;
          ref_of_a_transfer_id: string | null;
          ref_of_b_transfer_id: string | null;
          capture_method: PayoutCaptureMethod | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          referral_id: string;
          bounty_id: string;
          referrer_id: string;
          stripe_account_id?: string | null;
          amount: number;
          currency: string;
          status?: PayoutStatus;
          stripe_transfer_id?: string | null;
          stripe_error_code?: string | null;
          failure_reason?: string | null;
          payment_intent_id?: string | null;
          invoice_id?: string | null;
          invoice_hosted_url?: string | null;
          transfer_group?: string | null;
          total_cents?: number | null;
          amount_referrer_cents?: number | null;
          amount_candidate_cents?: number | null;
          amount_ref_of_a_cents?: number | null;
          amount_ref_of_b_cents?: number | null;
          amount_platform_fee_cents?: number | null;
          referrer_transfer_id?: string | null;
          candidate_transfer_id?: string | null;
          ref_of_a_transfer_id?: string | null;
          ref_of_b_transfer_id?: string | null;
          capture_method?: PayoutCaptureMethod | null;
        };
        Update: {
          status?: PayoutStatus;
          stripe_transfer_id?: string | null;
          stripe_error_code?: string | null;
          failure_reason?: string | null;
          processing_started_at?: string | null;
          paid_at?: string | null;
          failed_at?: string | null;
          cancelled_at?: string | null;
          payment_intent_id?: string | null;
          invoice_id?: string | null;
          invoice_hosted_url?: string | null;
          transfer_group?: string | null;
          total_cents?: number | null;
          amount_referrer_cents?: number | null;
          amount_candidate_cents?: number | null;
          amount_ref_of_a_cents?: number | null;
          amount_ref_of_b_cents?: number | null;
          amount_platform_fee_cents?: number | null;
          referrer_transfer_id?: string | null;
          candidate_transfer_id?: string | null;
          ref_of_a_transfer_id?: string | null;
          ref_of_b_transfer_id?: string | null;
          capture_method?: PayoutCaptureMethod | null;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "payouts_referral_id_fkey"; columns: ["referral_id"]; referencedRelation: "bounty_referrals"; referencedColumns: ["id"]; },
          { foreignKeyName: "payouts_bounty_id_fkey"; columns: ["bounty_id"]; referencedRelation: "bounties"; referencedColumns: ["id"]; },
          { foreignKeyName: "payouts_referrer_id_fkey"; columns: ["referrer_id"]; referencedRelation: "profiles"; referencedColumns: ["id"]; },
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
      hire_proof_documents: {
        Row: {
          id: string;
          referral_id: string;
          user_id: string;
          storage_path: string;
          mime_type: string | null;
          file_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          referral_id: string;
          user_id: string;
          storage_path: string;
          mime_type?: string | null;
          file_size?: number | null;
          created_at?: string;
        };
        Update: {
          storage_path?: string;
          mime_type?: string | null;
          file_size?: number | null;
        };
        Relationships: [
          { foreignKeyName: "hire_proof_documents_referral_id_fkey"; columns: ["referral_id"]; referencedRelation: "bounty_referrals"; referencedColumns: ["id"]; },
          { foreignKeyName: "hire_proof_documents_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"]; },
        ];
      };
      referral_rejections: {
        Row: {
          id: string;
          referral_id: string;
          stage: RejectionStage;
          reason: string;
          rejected_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          referral_id: string;
          stage: RejectionStage;
          reason: string;
          rejected_by: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          { foreignKeyName: "referral_rejections_referral_id_fkey"; columns: ["referral_id"]; referencedRelation: "bounty_referrals"; referencedColumns: ["id"]; },
        ];
      };
      referral_disputes: {
        Row: {
          id: string;
          referral_id: string;
          opened_by: string;
          reason: string;
          status: DisputeStatus;
          resolver_id: string | null;
          resolution: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          referral_id: string;
          opened_by: string;
          reason: string;
          status?: DisputeStatus;
          resolver_id?: string | null;
          resolution?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          status?: DisputeStatus;
          resolver_id?: string | null;
          resolution?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "referral_disputes_referral_id_fkey"; columns: ["referral_id"]; referencedRelation: "bounty_referrals"; referencedColumns: ["id"]; },
        ];
      };
      payment_reminders: {
        Row: {
          id: string;
          referral_id: string;
          due_day: 7 | 10 | 13;
          channel: "email" | "in_app";
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          referral_id: string;
          due_day: 7 | 10 | 13;
          channel: "email" | "in_app";
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          sent_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "payment_reminders_referral_id_fkey"; columns: ["referral_id"]; referencedRelation: "bounty_referrals"; referencedColumns: ["id"]; },
        ];
      };
      reputation_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: ReputationEventType;
          amount_cents: number | null;
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: ReputationEventType;
          amount_cents?: number | null;
          reference_id?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          { foreignKeyName: "reputation_events_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"]; },
        ];
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
      is_kyc_approved: {
        Args: { p_user?: string };
        Returns: boolean;
      };
      owns_bounty: {
        Args: { p_bounty: string };
        Returns: boolean;
      };
      expire_stale_bounties: {
        Args: Record<string, never>;
        Returns: number;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      admin_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_referrer_pair: {
        Args: { p_referral: string };
        Returns: { referrer_of_a: string | null; referrer_of_b: string | null }[];
      };
    };
    Enums: {
      user_role: UserRole;
      kyc_status: KycStatus;
      audit_action: AuditAction;
      bounty_status: BountyStatus;
      bounty_payment_mode: BountyPaymentMode;
      referral_status: ReferralStatus;
      rejection_stage: RejectionStage;
      dispute_status: DisputeStatus;
      reputation_event_type: ReputationEventType;
      payout_status: PayoutStatus;
      payout_capture_method: PayoutCaptureMethod;
    };
    CompositeTypes: Record<string, never>;
  };
};
