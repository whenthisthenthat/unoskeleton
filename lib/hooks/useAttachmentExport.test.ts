import {
  guessMimeType,
  sanitizeFilename,
} from "@/lib/hooks/useAttachmentExport";

// Module mocks — prevent import resolution failures for native modules.
// Only the pure functions are tested; the hook itself is not rendered.
jest.mock("expo-file-system", () => ({
  File: jest.fn(),
  Directory: jest.fn(),
  Paths: { cache: "/cache" },
}));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-intent-launcher", () => ({}));
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("@/lib/vault/vault-instance", () => ({
  getVault: jest.fn(),
}));

describe("sanitizeFilename", () => {
  it("passes through simple alphanumeric filenames", () => {
    expect(sanitizeFilename("report2024")).toBe("report2024");
  });

  it("preserves dots, hyphens, and underscores", () => {
    expect(sanitizeFilename("my-file_v2.txt")).toBe("my-file_v2.txt");
  });

  it("replaces spaces with underscores", () => {
    expect(sanitizeFilename("my file name")).toBe("my_file_name");
  });

  it("replaces brackets and special characters", () => {
    expect(sanitizeFilename("report (1).pdf")).toBe("report__1_.pdf");
  });

  it("replaces unicode and emoji characters", () => {
    expect(sanitizeFilename("café résumé.doc")).toBe("caf__r_sum_.doc");
  });

  it("handles empty string", () => {
    expect(sanitizeFilename("")).toBe("");
  });

  it("replaces consecutive special characters individually", () => {
    expect(sanitizeFilename("a@#$b")).toBe("a___b");
  });
});

describe("guessMimeType", () => {
  it("returns image/jpeg for .jpg", () => {
    expect(guessMimeType("photo.jpg")).toBe("image/jpeg");
  });

  it("returns image/jpeg for .jpeg", () => {
    expect(guessMimeType("photo.jpeg")).toBe("image/jpeg");
  });

  it("returns image/png for .png", () => {
    expect(guessMimeType("screenshot.png")).toBe("image/png");
  });

  it("returns image/gif for .gif", () => {
    expect(guessMimeType("animation.gif")).toBe("image/gif");
  });

  it("returns application/pdf for .pdf", () => {
    expect(guessMimeType("document.pdf")).toBe("application/pdf");
  });

  it("returns text/plain for .txt", () => {
    expect(guessMimeType("notes.txt")).toBe("text/plain");
  });

  it("returns application/msword for .doc", () => {
    expect(guessMimeType("letter.doc")).toBe("application/msword");
  });

  it("returns application/msword for .docx", () => {
    expect(guessMimeType("letter.docx")).toBe("application/msword");
  });

  it("returns application/octet-stream for unknown extensions", () => {
    expect(guessMimeType("data.bin")).toBe("application/octet-stream");
  });

  it("handles uppercase extensions (case-insensitive)", () => {
    expect(guessMimeType("photo.PNG")).toBe("image/png");
    expect(guessMimeType("photo.JPG")).toBe("image/jpeg");
  });

  it("handles filenames with multiple dots", () => {
    expect(guessMimeType("archive.2024.01.pdf")).toBe("application/pdf");
  });

  it("returns application/octet-stream for no extension", () => {
    expect(guessMimeType("README")).toBe("application/octet-stream");
  });
});
