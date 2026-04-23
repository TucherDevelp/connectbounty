import { z } from "zod";

/**
 * Zentrale Env-Validation.
 *
 * Schlägt sofort mit einer lesbaren Fehlermeldung fehl, wenn eine Variable
 * fehlt oder das falsche Format hat – statt erst zur Laufzeit irgendwo tief
 * im Stack zu crashen.
 *
 * Server- vs. Client-Trennung:
 *  - serverEnv() darf NIE in Client Components / Browser-Code aufgerufen
 *    werden – Next.js würde sonst beim Build mit einem leeren Wert ersetzen.
 *  - clientEnv() enthält ausschließlich Werte mit NEXT_PUBLIC_-Prefix.
 *
 * Beide sind lazy + memoized, damit Tests Werte vor dem ersten Aufruf
 * setzen können und der Aufruf-Site klar bleibt.
 */

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40, "SUPABASE_SERVICE_ROLE_KEY fehlt oder ungültig"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // KYC
  KYC_PROVIDER: z.enum(["mock", "ballerine"]).default("mock"),
  KYC_WEBHOOK_SECRET: z.string().min(16, "KYC_WEBHOOK_SECRET mindestens 16 Zeichen"),
  // Ballerine – optional, wird erst validiert wenn KYC_PROVIDER=ballerine
  BALLERINE_API_URL: z.string().url().optional(),
  BALLERINE_API_KEY: z.string().min(1).optional(),
  BALLERINE_WORKFLOW_ID: z.string().min(1).optional(),
  BALLERINE_WEBHOOK_SECRET: z.string().min(1).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL muss eine URL sein"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(40, "NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt oder ungültig"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  input: Record<string, string | undefined>,
  scope: string,
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[env:${scope}] Konfiguration ungültig:\n${issues}\n\nPrüfe deine .env.local (siehe .env.example).`,
    );
  }
  return result.data;
}

let cachedClientEnv: z.infer<typeof clientSchema> | null = null;
export function clientEnv(): z.infer<typeof clientSchema> {
  if (cachedClientEnv) return cachedClientEnv;
  cachedClientEnv = parseOrThrow(
    clientSchema,
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    },
    "client",
  );
  return cachedClientEnv;
}

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;
export function serverEnv(): z.infer<typeof serverSchema> {
  if (cachedServerEnv) return cachedServerEnv;
  cachedServerEnv = parseOrThrow(
    serverSchema,
    {
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NODE_ENV: process.env.NODE_ENV,
      KYC_PROVIDER: process.env.KYC_PROVIDER,
      KYC_WEBHOOK_SECRET: process.env.KYC_WEBHOOK_SECRET,
      BALLERINE_API_URL: process.env.BALLERINE_API_URL,
      BALLERINE_API_KEY: process.env.BALLERINE_API_KEY,
      BALLERINE_WORKFLOW_ID: process.env.BALLERINE_WORKFLOW_ID,
      BALLERINE_WEBHOOK_SECRET: process.env.BALLERINE_WEBHOOK_SECRET,
    },
    "server",
  );
  return cachedServerEnv;
}

/** Nur für Tests: leert den Parse-Cache. */
export function __resetEnvCacheForTests(): void {
  cachedClientEnv = null;
  cachedServerEnv = null;
}
