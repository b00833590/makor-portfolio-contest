import { describe, it, expect } from "vitest";
import { roleHomePath, roleLabel } from "./role-display";

describe("roleHomePath", () => {
  it("sends ADMIN to /admin", () => {
    expect(roleHomePath("ADMIN")).toBe("/admin");
  });

  it("sends DIRECTEUR to /directeur", () => {
    expect(roleHomePath("DIRECTEUR")).toBe("/directeur");
  });

  it("sends PARTICIPANT to /dashboard", () => {
    expect(roleHomePath("PARTICIPANT")).toBe("/dashboard");
  });
});

describe("roleLabel", () => {
  it("labels ADMIN as Administrateur", () => {
    expect(roleLabel("ADMIN")).toBe("Administrateur");
  });

  it("labels DIRECTEUR as Directeur", () => {
    expect(roleLabel("DIRECTEUR")).toBe("Directeur");
  });

  it("labels PARTICIPANT as Participant", () => {
    expect(roleLabel("PARTICIPANT")).toBe("Participant");
  });
});
