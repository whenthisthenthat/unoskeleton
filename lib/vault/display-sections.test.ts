import { extractDisplaySections } from "@/lib/vault/display-sections";
import type { ItemDetails, ItemOverview } from "@/lib/vault/types";

describe("extractDisplaySections", () => {
  it("should create primary section from top-level fields", () => {
    const details: ItemDetails = {
      fields: [
        {
          name: "username",
          type: "T",
          value: "user@test.com",
          designation: "username",
        },
        {
          name: "password",
          type: "P",
          value: "secret",
          designation: "password",
        },
      ],
      sections: [],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("");
    expect(sections[0].fields).toHaveLength(2);
    expect(sections[0].fields[0].label).toBe("Username");
    expect(sections[0].fields[0].sensitive).toBe(false);
    expect(sections[0].fields[1].label).toBe("Password");
    expect(sections[0].fields[1].sensitive).toBe(true);
  });

  it("should filter out empty-value fields", () => {
    const details: ItemDetails = {
      fields: [
        {
          name: "username",
          type: "T",
          value: "user",
          designation: "username",
        },
        {
          name: "password",
          type: "P",
          value: "",
          designation: "password",
        },
      ],
      sections: [],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections[0].fields).toHaveLength(1);
  });

  it("should mark concealed section fields as sensitive", () => {
    const details: ItemDetails = {
      fields: [],
      sections: [
        {
          name: "s1",
          title: "Security",
          fields: [{ k: "concealed", n: "f1", t: "PIN", v: "1234" }],
        },
      ],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections[0].fields[0].sensitive).toBe(true);
    expect(sections[0].fields[0].kind).toBe("password");
  });

  it("should add notes section when notesPlain is present", () => {
    const details: ItemDetails = {
      fields: [],
      sections: [],
      notesPlain: "Important notes here",
    };
    const sections = extractDisplaySections(details);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Notes");
    expect(sections[0].fields[0].kind).toBe("note");
  });

  it("should format date fields from unix timestamps", () => {
    const details: ItemDetails = {
      fields: [],
      sections: [
        {
          name: "s1",
          title: "Dates",
          fields: [{ k: "date", n: "f1", t: "Expiry", v: 1700000000 }],
        },
      ],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections[0].fields[0].kind).toBe("date");
    expect(sections[0].fields[0].value.length).toBeGreaterThan(0);
  });

  it("should return empty array when details have no content", () => {
    const details: ItemDetails = {
      fields: [],
      sections: [],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections).toEqual([]);
  });

  it("should detect TOTP fields and assign kind 'totp'", () => {
    const details: ItemDetails = {
      fields: [],
      sections: [
        {
          name: "s1",
          title: "Security",
          fields: [
            {
              k: "concealed",
              n: "TOTP_F9B6411996AB4A35AD88B28E17E87416",
              t: "",
              v: "otpauth://totp/GitHub:calvin?secret=JBSWY3DPEHPK3PXP&issuer=GitHub",
            },
          ],
        },
      ],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections[0].fields[0].kind).toBe("totp");
    expect(sections[0].fields[0].sensitive).toBe(false);
    expect(sections[0].fields[0].label).toBe("One-Time Password");
    expect(sections[0].fields[0].value).toContain("otpauth://");
  });

  it("should use field label for TOTP when available", () => {
    const details: ItemDetails = {
      fields: [],
      sections: [
        {
          name: "s1",
          title: "Security",
          fields: [
            {
              k: "concealed",
              n: "TOTP_ABC123",
              t: "2FA Code",
              v: "otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP",
            },
          ],
        },
      ],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections[0].fields[0].label).toBe("2FA Code");
  });

  it("should not treat non-TOTP concealed fields as TOTP", () => {
    const details: ItemDetails = {
      fields: [],
      sections: [
        {
          name: "s1",
          title: "Security",
          fields: [{ k: "concealed", n: "regular_field", t: "PIN", v: "1234" }],
        },
      ],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections[0].fields[0].kind).toBe("password");
    expect(sections[0].fields[0].sensitive).toBe(true);
  });

  it("should move non-designated password fields to form section when designated password exists", () => {
    const details: ItemDetails = {
      fields: [
        {
          name: "j_username",
          type: "T",
          value: "322686881",
          designation: "username",
        },
        { name: "j_password", type: "P", value: "Emk7hoD<YbLC59FTi)vn" },
        {
          name: "password",
          type: "P",
          value: "NgsBpf^UH7Rznf3gttNH",
          designation: "password",
        },
      ],
      sections: [],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    const primary = sections.find((s) => s.title === "");
    expect(primary!.fields).toHaveLength(2);
    expect(primary!.fields[0].label).toBe("Username");
    expect(primary!.fields[1].label).toBe("Password");
    const formSection = sections.find(
      (s) => s.title === "Saved from form details",
    );
    expect(formSection).toBeDefined();
    expect(formSection!.fields).toHaveLength(1);
    expect(formSection!.fields[0].label).toBe("J_password");
    expect(formSection!.fields[0].sensitive).toBe(true);
  });

  it("should put non-designated password fields in form section", () => {
    const details: ItemDetails = {
      fields: [
        { name: "pass1", type: "P", value: "abc123" },
        { name: "pass2", type: "P", value: "def456" },
      ],
      sections: [],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    const primary = sections.find((s) => s.title === "");
    expect(primary).toBeUndefined();
    const formSection = sections.find(
      (s) => s.title === "Saved from form details",
    );
    expect(formSection).toBeDefined();
    expect(formSection!.fields).toHaveLength(2);
  });

  it("should format address fields", () => {
    const details: ItemDetails = {
      fields: [],
      sections: [
        {
          name: "s1",
          title: "Address",
          fields: [
            {
              k: "address",
              n: "f1",
              t: "Home",
              v: {
                street: "123 Main St",
                city: "Springfield",
                state: "IL",
                zip: "62701",
                country: "US",
              },
            },
          ],
        },
      ],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections[0].fields[0].value).toBe(
      "123 Main St, Springfield, IL, 62701, US",
    );
  });

  it("should extract websites section from overview URLs", () => {
    const details: ItemDetails = { fields: [], sections: [], notesPlain: "" };
    const overview = {
      title: "GitHub",
      URLs: [
        { u: "https://github.com", l: "GitHub" },
        { u: "https://github.com/login", l: "Login" },
      ],
    };
    const sections = extractDisplaySections(details, overview);
    const websites = sections.find((s) => s.title === "Websites");
    expect(websites).toBeDefined();
    expect(websites!.fields).toHaveLength(2);
    expect(websites!.fields[0].value).toBe("https://github.com");
    expect(websites!.fields[0].label).toBe("GitHub");
    expect(websites!.fields[0].kind).toBe("url");
  });

  it("should use 'Website' as default label when URL has no label", () => {
    const details: ItemDetails = { fields: [], sections: [], notesPlain: "" };
    const overview = {
      title: "Test",
      URLs: [{ u: "https://example.com" }],
    };
    const sections = extractDisplaySections(details, overview);
    const websites = sections.find((s) => s.title === "Websites");
    expect(websites!.fields[0].label).toBe("Website");
  });

  it("should extract linked apps section from overview appIds", () => {
    const details: ItemDetails = { fields: [], sections: [], notesPlain: "" };
    const overview = {
      title: "Test",
      appIds: [
        { name: "MyApp", id: "com.example.myapp" },
        { name: "Other", id: "com.example.other" },
      ],
    };
    const sections = extractDisplaySections(details, overview);
    const linkedApps = sections.find((s) => s.title === "Linked Apps");
    expect(linkedApps).toBeDefined();
    expect(linkedApps!.fields).toHaveLength(2);
    expect(linkedApps!.fields[0].label).toBe("MyApp");
    expect(linkedApps!.fields[0].value).toBe("com.example.myapp");
  });

  it("should filter out invalid entries from appIds", () => {
    const details: ItemDetails = { fields: [], sections: [], notesPlain: "" };
    // Intentionally malformed data to test defensive filtering of decrypted JSON
    const overview = {
      title: "Test",
      appIds: [
        null,
        "not-an-object",
        { name: "Valid", id: "com.valid" },
        { id: "no-name" },
      ],
    } as unknown as ItemOverview;
    const sections = extractDisplaySections(details, overview);
    const linkedApps = sections.find((s) => s.title === "Linked Apps");
    expect(linkedApps).toBeDefined();
    expect(linkedApps!.fields).toHaveLength(1);
    expect(linkedApps!.fields[0].label).toBe("Valid");
  });

  it("should format monthYear fields as MM/YYYY", () => {
    const details: ItemDetails = {
      fields: [],
      sections: [
        {
          name: "s1",
          title: "Card",
          fields: [{ k: "monthYear", n: "f1", t: "Expiry", v: 202503 }],
        },
      ],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections[0].fields[0].value).toBe("03/2025");
    expect(sections[0].fields[0].kind).toBe("date");
  });

  it("should format cctype fields with known card names", () => {
    const details: ItemDetails = {
      fields: [],
      sections: [
        {
          name: "s1",
          title: "Card",
          fields: [{ k: "cctype", n: "f1", t: "Type", v: "visa" }],
        },
      ],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections[0].fields[0].value).toBe("Visa");
  });

  it("should fall back to raw value for unknown cctype", () => {
    const details: ItemDetails = {
      fields: [],
      sections: [
        {
          name: "s1",
          title: "Card",
          fields: [{ k: "cctype", n: "f1", t: "Type", v: "unknown_card" }],
        },
      ],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections[0].fields[0].value).toBe("unknown_card");
  });

  it("should use 'Field' as default label for fields without name or designation", () => {
    const details: ItemDetails = {
      fields: [{ name: "", type: "T", value: "some-value" }],
      sections: [],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    const formSection = sections.find(
      (s) => s.title === "Saved from form details",
    );
    expect(formSection!.fields[0].label).toBe("Field");
  });

  it("should map field type E to email kind", () => {
    const details: ItemDetails = {
      fields: [
        {
          name: "email",
          type: "E",
          value: "test@test.com",
          designation: "username",
        },
      ],
      sections: [],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections[0].fields[0].kind).toBe("email");
  });

  it("should map field type U to url kind", () => {
    const details: ItemDetails = {
      fields: [{ name: "site", type: "U", value: "https://example.com" }],
      sections: [],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    const formSection = sections.find(
      (s) => s.title === "Saved from form details",
    );
    expect(formSection!.fields[0].kind).toBe("url");
  });

  it("should map field type TEL to phone kind", () => {
    const details: ItemDetails = {
      fields: [{ name: "phone", type: "TEL", value: "555-1234" }],
      sections: [],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    const formSection = sections.find(
      (s) => s.title === "Saved from form details",
    );
    expect(formSection!.fields[0].kind).toBe("phone");
  });

  it("should map section field kinds URL, email, phone to display kinds", () => {
    const details: ItemDetails = {
      fields: [],
      sections: [
        {
          name: "s1",
          title: "Contact",
          fields: [
            { k: "URL", n: "f1", t: "Website", v: "https://example.com" },
            { k: "email", n: "f2", t: "Email", v: "test@test.com" },
            { k: "phone", n: "f3", t: "Phone", v: "555-1234" },
          ],
        },
      ],
      notesPlain: "",
    };
    const sections = extractDisplaySections(details);
    expect(sections[0].fields[0].kind).toBe("url");
    expect(sections[0].fields[1].kind).toBe("email");
    expect(sections[0].fields[2].kind).toBe("phone");
  });
});
