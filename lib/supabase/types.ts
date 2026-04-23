/**
 * Generierte DB-Typen werden ab Phase 1 (Schema v1) hier von der Supabase
 * CLI hinterlegt:
 *
 *   npx supabase gen types typescript \
 *     --project-id gggovrqckwhjqipfoetu --schema public > lib/supabase/types.ts
 *
 * Bis dahin verwenden wir einen leeren, aber strukturell korrekten Stub,
 * damit die Helper bereits typsicher genutzt werden können.
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
