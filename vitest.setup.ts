import { vi } from "vitest";

// Next.js resolves "server-only" to a no-op only inside its own bundler.
// Outside of it (here, under Vitest) the real package always throws, so we
// stub it for every test that transitively imports server-only modules.
vi.mock("server-only", () => ({}));
