import { describe, it, expect } from "vitest";
import { buildCredentialsMailto } from "./credentials-mailto";

describe("buildCredentialsMailto", () => {
  it("builds a mailto link with the recipient, subject and body encoded", () => {
    const link = buildCredentialsMailto({
      email: "adam.dupont@example.com",
      name: "Adam Dupont",
      tempPassword: "Xy7kPq2mAb",
    });

    expect(link).toMatch(/^mailto:adam\.dupont%40example\.com\?/);
    expect(link).toContain("subject=");
    expect(link).toContain("body=");
    expect(link).toContain(encodeURIComponent("Xy7kPq2mAb"));
  });

  it("encodes spaces as %20, not +", () => {
    const link = buildCredentialsMailto({ email: "a@b.com", name: "Adam Dupont", tempPassword: "pw" });

    expect(link).not.toContain("+");
    expect(link).toContain("%20");
  });
});
