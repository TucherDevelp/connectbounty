import "server-only";

import { serverEnv } from "@/lib/env";
import type { KycProvider } from "./types";
import { MockProvider } from "./mock-provider";
import { BallerineProvider } from "./ballerine-provider";

let cached: KycProvider | null = null;

/**
 * Liefert die aktive KYC-Provider-Instanz basierend auf KYC_PROVIDER.
 * Singleton pro Prozess - Provider sind zustandslos, das ist sicher.
 */
export function getKycProvider(): KycProvider {
  if (cached) return cached;
  const env = serverEnv();
  cached = env.KYC_PROVIDER === "ballerine" ? new BallerineProvider() : new MockProvider();
  return cached;
}

/** Nur für Tests. */
export function __resetKycProviderCache(): void {
  cached = null;
}
