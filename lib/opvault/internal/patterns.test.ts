import {
  PROFILE_PATTERN,
  LD_WRAPPER_PATTERN,
  BAND_FILENAME_PATTERN,
  ATTACHMENT_FILENAME_PATTERN,
} from "@/lib/opvault/internal/patterns";

describe("PROFILE_PATTERN", () => {
  it("should match valid profile.js content", () => {
    const input = 'var profile = {"salt":"abc","iterations":50000};';
    const match = PROFILE_PATTERN.exec(input);

    expect(match).not.toBeNull();
    expect(match![1]).toBe('{"salt":"abc","iterations":50000}');
  });

  it("should match without trailing semicolon", () => {
    const input = 'var profile = {"salt":"abc"}';
    const match = PROFILE_PATTERN.exec(input);

    expect(match).not.toBeNull();
    expect(match![1]).toBe('{"salt":"abc"}');
  });

  it("should match multiline JSON", () => {
    const input =
      'var profile = {\n  "salt": "abc",\n  "iterations": 50000\n};';
    const match = PROFILE_PATTERN.exec(input);

    expect(match).not.toBeNull();
    expect(JSON.parse(match![1])).toEqual({
      salt: "abc",
      iterations: 50000,
    });
  });

  it("should not match malformed input", () => {
    expect(PROFILE_PATTERN.exec("var something = {};")).toBeNull();
    expect(PROFILE_PATTERN.exec("profile = {};")).toBeNull();
  });
});

describe("LD_WRAPPER_PATTERN", () => {
  it("should match valid ld wrapper", () => {
    const input = 'ld({"uuid":"ABC"});';
    const match = LD_WRAPPER_PATTERN.exec(input);

    expect(match).not.toBeNull();
    expect(match![1]).toBe('{"uuid":"ABC"}');
  });

  it("should match without trailing semicolon", () => {
    const input = 'ld({"uuid":"ABC"})';
    const match = LD_WRAPPER_PATTERN.exec(input);

    expect(match).not.toBeNull();
    expect(match![1]).toBe('{"uuid":"ABC"}');
  });

  it("should match multiline content", () => {
    const input = 'ld({\n  "uuid": "ABC",\n  "k": "data"\n});';
    const match = LD_WRAPPER_PATTERN.exec(input);

    expect(match).not.toBeNull();
    expect(JSON.parse(match![1])).toEqual({ uuid: "ABC", k: "data" });
  });

  it("should not match non-ld functions", () => {
    expect(LD_WRAPPER_PATTERN.exec('fn({"a":1});')).toBeNull();
  });
});

describe("BAND_FILENAME_PATTERN", () => {
  it.each(["0", "1", "9", "A", "B", "F"])("should match band_%s.js", (char) => {
    const match = BAND_FILENAME_PATTERN.exec(`band_${char}.js`);

    expect(match).not.toBeNull();
    expect(match![1]).toBe(char);
  });

  it("should not match lowercase band characters", () => {
    expect(BAND_FILENAME_PATTERN.exec("band_a.js")).toBeNull();
    expect(BAND_FILENAME_PATTERN.exec("band_f.js")).toBeNull();
  });

  it("should not match invalid band characters", () => {
    expect(BAND_FILENAME_PATTERN.exec("band_G.js")).toBeNull();
    expect(BAND_FILENAME_PATTERN.exec("band_Z.js")).toBeNull();
  });

  it("should not match wrong extensions or prefixes", () => {
    expect(BAND_FILENAME_PATTERN.exec("band_0.json")).toBeNull();
    expect(BAND_FILENAME_PATTERN.exec("xband_0.js")).toBeNull();
  });
});

describe("ATTACHMENT_FILENAME_PATTERN", () => {
  const validFilename =
    "AAAA0000BBBB1111CCCC2222DDDD3333_1111000022223333444455556666AAAA.attachment";

  it("should match valid attachment filename", () => {
    const match = ATTACHMENT_FILENAME_PATTERN.exec(validFilename);

    expect(match).not.toBeNull();
    expect(match![1]).toBe("AAAA0000BBBB1111CCCC2222DDDD3333");
    expect(match![2]).toBe("1111000022223333444455556666AAAA");
  });

  it("should not match lowercase UUIDs", () => {
    expect(
      ATTACHMENT_FILENAME_PATTERN.exec(
        "aaaa0000bbbb1111cccc2222dddd3333_1111000022223333444455556666aaaa.attachment",
      ),
    ).toBeNull();
  });

  it("should not match wrong UUID length", () => {
    expect(
      ATTACHMENT_FILENAME_PATTERN.exec(
        "AAAA0000BBBB1111_1111000022223333.attachment",
      ),
    ).toBeNull();
  });

  it("should not match wrong extension", () => {
    expect(
      ATTACHMENT_FILENAME_PATTERN.exec(
        "AAAA0000BBBB1111CCCC2222DDDD3333_1111000022223333444455556666AAAA.attach",
      ),
    ).toBeNull();
  });
});
