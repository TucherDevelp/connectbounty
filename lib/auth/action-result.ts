/**
 * Diskriminierte Union für Server-Action-Ergebnisse, die vom Client ohne
 * Throw konsumiert werden können (kompatibel zu useActionState).
 *
 * - status "idle"   - noch nichts gesendet (Initial-Wert)
 * - status "ok"     - Erfolg, optional Nachricht für Banner
 * - status "error"  - globale Fehler (z. B. Login fehlgeschlagen)
 *                     plus optional Feld-Errors aus Zod
 */
export type ActionState =
  | { status: "idle" }
  | { status: "ok"; message?: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

export const idleAction: ActionState = { status: "idle" };

export function actionError(
  message: string,
  fieldErrors?: Record<string, string>,
): ActionState {
  return fieldErrors ? { status: "error", message, fieldErrors } : { status: "error", message };
}

export function actionOk(message?: string): ActionState {
  return message ? { status: "ok", message } : { status: "ok" };
}

/**
 * Wandelt Zod-Issues in ein flaches Feldname → Fehlertext-Mapping.
 * Letzter Issue pro Feld gewinnt - im UI zeigen wir nur einen Text pro Feld.
 */
export function fieldErrorsFromZod(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_";
    out[key] = issue.message;
  }
  return out;
}
