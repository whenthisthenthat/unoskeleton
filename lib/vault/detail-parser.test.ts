import { parseItemDetails } from "@/lib/vault/detail-parser";

describe("parseItemDetails", () => {
  it("should return defaults for null input", () => {
    expect(parseItemDetails(null)).toEqual({
      fields: [],
      sections: [],
      notesPlain: "",
    });
  });

  it("should return defaults for non-object input", () => {
    expect(parseItemDetails("not an object")).toEqual({
      fields: [],
      sections: [],
      notesPlain: "",
    });
  });

  it("should parse fields array", () => {
    const raw = {
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
    };
    const result = parseItemDetails(raw);
    expect(result.fields).toHaveLength(2);
    expect(result.fields[0].designation).toBe("username");
    expect(result.fields[0].value).toBe("user@test.com");
    expect(result.fields[1].type).toBe("P");
  });

  it("should parse sections with fields", () => {
    const raw = {
      sections: [
        {
          name: "sec1",
          title: "Details",
          fields: [
            { k: "string", n: "field1", t: "Label 1", v: "Value 1" },
            { k: "concealed", n: "field2", t: "Secret", v: "hidden" },
          ],
        },
      ],
    };
    const result = parseItemDetails(raw);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].fields).toHaveLength(2);
    expect(result.sections[0].fields![1].k).toBe("concealed");
  });

  it("should parse notesPlain", () => {
    const raw = { notesPlain: "Some notes here" };
    const result = parseItemDetails(raw);
    expect(result.notesPlain).toBe("Some notes here");
  });

  it("should handle fields with missing value", () => {
    const raw = { fields: [{ name: "test", type: "T" }] };
    const result = parseItemDetails(raw);
    expect(result.fields[0].value).toBe("");
  });

  it("should default unknown field types to T", () => {
    const raw = {
      fields: [{ name: "test", type: "UNKNOWN", value: "val" }],
    };
    const result = parseItemDetails(raw);
    expect(result.fields[0].type).toBe("T");
  });

  it("should skip fields without name property", () => {
    const raw = {
      fields: [
        { type: "T", value: "val" },
        { name: "valid", type: "T", value: "ok" },
      ],
    };
    const result = parseItemDetails(raw);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].name).toBe("valid");
  });
});
