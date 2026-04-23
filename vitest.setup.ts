import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// "server-only" wirft beim Import in Browser/Test-Bundles. In Vitest wollen
// wir Server-Module direkt testen können, daher global no-op-mocken.
vi.mock("server-only", () => ({}));
