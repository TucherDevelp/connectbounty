import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind-aware className combiner. Verhindert Konflikte zwischen
 * gleichzeitig gesetzten Tailwind-Klassen (z. B. `px-2 px-4`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
