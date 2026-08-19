import { describe, it, expect } from "vitest";

// Smoke test: verifies the Vitest runner and jsdom environment are wired up.
// Replace with real unit tests when implementing tickets.
describe("test tooling", () => {
  it("provides a jsdom environment", () => {
    expect(typeof document).toBe("object");
  });
});
