import { describe, it, expect } from "vitest";
import { getContactMethods, type SiteContact } from "./site-contact";

const FULL: SiteContact = {
  name: "Adam Rouas",
  role: "Gestion de la plateforme",
  email: "adam@example.com",
  linkedinUrl: "https://www.linkedin.com/in/adam-rouas/",
  instagramUrl: "https://www.instagram.com/adam.rouas",
  phone: "+33 6 12 34 56 78",
};

describe("getContactMethods", () => {
  it("builds cliquable links for every filled field, in a stable order", () => {
    const methods = getContactMethods(FULL);

    expect(methods.map((m) => m.kind)).toEqual(["email", "linkedin", "instagram", "phone"]);
    expect(methods[0]).toMatchObject({ href: "mailto:adam@example.com", external: false });
    expect(methods[1]).toMatchObject({
      href: "https://www.linkedin.com/in/adam-rouas/",
      display: "www.linkedin.com/in/adam-rouas",
      external: true,
    });
    expect(methods[2].display).toBe("www.instagram.com/adam.rouas");
    // tel: garde le + mais retire espaces et ponctuation
    expect(methods[3]).toMatchObject({ href: "tel:+33612345678", external: false });
  });

  it("skips fields left empty", () => {
    const methods = getContactMethods({ ...FULL, linkedinUrl: "", phone: "  " });

    expect(methods.map((m) => m.kind)).toEqual(["email", "instagram"]);
  });

  it("returns an empty list when nothing is configured", () => {
    expect(getContactMethods({ ...FULL, email: "", linkedinUrl: "", instagramUrl: "", phone: "" })).toEqual([]);
  });
});
