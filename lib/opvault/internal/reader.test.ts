/**
 * Tests for OPVault orchestration layer
 * Validates vault reading, parallel operations, and integration
 */
import * as FileReader from "@/lib/opvault/internal/file-reader";
import * as Parser from "@/lib/opvault/internal/parser";
import {
  readAndParseProfile,
  readAndParseBands,
  readAndParseBandsProgressively,
} from "@/lib/opvault/internal/reader";
import type { OPVaultItem, BandFile, Profile } from "@/lib/opvault/types";

jest.mock("./file-reader");
jest.mock("./parser");

// Typed mock references
const mockedReadProfileFile = jest.mocked(FileReader.readProfileFile);
const mockedDiscoverBandLetters = jest.mocked(FileReader.discoverBandLetters);
const mockedReadBandFileContent = jest.mocked(FileReader.readBandFileContent);
const mockedParseProfile = jest.mocked(Parser.parseProfile);
const mockedParseBandFile = jest.mocked(Parser.parseBandFile);

describe("vault-reader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("readAndParseBandsProgressively", () => {
    it("should read each band file sequentially and call onBand", async () => {
      mockedDiscoverBandLetters.mockResolvedValue(["0", "A"]);
      mockedReadBandFileContent
        .mockResolvedValueOnce("band 0")
        .mockResolvedValueOnce("band A");

      const band0: BandFile = { "item-0": { uuid: "item-0" } as OPVaultItem };
      const bandA: BandFile = { "item-A": { uuid: "item-A" } as OPVaultItem };
      mockedParseBandFile.mockReturnValueOnce(band0).mockReturnValueOnce(bandA);

      const received: BandFile[] = [];
      await readAndParseBandsProgressively(
        { uri: "vault", name: "vault", exists: true } as any,
        (bandData) => received.push(bandData),
      );

      expect(received).toHaveLength(2);
      expect(received[0]).toBe(band0);
      expect(received[1]).toBe(bandA);
      expect(FileReader.readBandFileContent).toHaveBeenCalledTimes(2);
    });

    it("should report progress after each band", async () => {
      mockedDiscoverBandLetters.mockResolvedValue(["0", "1", "2"]);
      mockedReadBandFileContent.mockResolvedValue("band content");
      mockedParseBandFile.mockReturnValue({});

      const progress: { loaded: number; total: number }[] = [];
      await readAndParseBandsProgressively(
        { uri: "vault", name: "vault", exists: true } as any,
        () => {},
        (loaded, total) => progress.push({ loaded, total }),
      );

      expect(progress).toEqual([
        { loaded: 1, total: 3 },
        { loaded: 2, total: 3 },
        { loaded: 3, total: 3 },
      ]);
    });

    it("should skip bands that return null content", async () => {
      mockedDiscoverBandLetters.mockResolvedValue(["0", "1"]);
      mockedReadBandFileContent
        .mockResolvedValueOnce("band 0")
        .mockResolvedValueOnce(null);

      const band0: BandFile = { "item-0": { uuid: "item-0" } as OPVaultItem };
      mockedParseBandFile.mockReturnValueOnce(band0);

      const received: BandFile[] = [];
      await readAndParseBandsProgressively(
        { uri: "vault", name: "vault", exists: true } as any,
        (bandData) => received.push(bandData),
      );

      expect(received).toHaveLength(1);
      expect(received[0]).toBe(band0);
      // parseBandFile only called once (skipped null)
      expect(Parser.parseBandFile).toHaveBeenCalledTimes(1);
    });

    it("should handle vault with no band files", async () => {
      mockedDiscoverBandLetters.mockResolvedValue([]);

      const received: BandFile[] = [];
      await readAndParseBandsProgressively(
        { uri: "vault", name: "vault", exists: true } as any,
        (bandData) => received.push(bandData),
      );

      expect(received).toHaveLength(0);
      expect(FileReader.readBandFileContent).not.toHaveBeenCalled();
    });

    it("should still report progress even when content is null", async () => {
      mockedDiscoverBandLetters.mockResolvedValue(["0", "1"]);
      mockedReadBandFileContent.mockResolvedValue(null);

      const progress: { loaded: number; total: number }[] = [];
      await readAndParseBandsProgressively(
        { uri: "vault", name: "vault", exists: true } as any,
        () => {},
        (loaded, total) => progress.push({ loaded, total }),
      );

      expect(progress).toEqual([
        { loaded: 1, total: 2 },
        { loaded: 2, total: 2 },
      ]);
    });
  });

  describe("readAndParseProfile", () => {
    const fakeSource = { sourceUri: "vault" } as any;

    it("should read and parse profile", async () => {
      const profile = { uuid: "prof-1", iterations: 50000 } as Profile;
      mockedReadProfileFile.mockResolvedValue("profile content");
      mockedParseProfile.mockReturnValue(profile);

      const result = await readAndParseProfile(fakeSource);

      expect(result).toBe(profile);
      expect(mockedReadProfileFile).toHaveBeenCalledWith(fakeSource);
      expect(mockedParseProfile).toHaveBeenCalledWith("profile content");
    });

    it("should propagate readProfile errors", async () => {
      mockedReadProfileFile.mockRejectedValue(new Error("file not found"));

      await expect(readAndParseProfile(fakeSource)).rejects.toThrow(
        "file not found",
      );
    });

    it("should propagate parseProfile errors", async () => {
      mockedReadProfileFile.mockResolvedValue("bad content");
      mockedParseProfile.mockImplementation(() => {
        throw new Error("invalid JSON");
      });

      await expect(readAndParseProfile(fakeSource)).rejects.toThrow(
        "invalid JSON",
      );
    });
  });

  describe("readAndParseBands", () => {
    const fakeSource = { sourceUri: "vault" } as any;

    it("should return items from multiple bands", async () => {
      mockedDiscoverBandLetters.mockResolvedValue(["0", "A"]);
      mockedReadBandFileContent
        .mockResolvedValueOnce("band 0")
        .mockResolvedValueOnce("band A");

      const band0: BandFile = { "id-0": { uuid: "id-0" } as OPVaultItem };
      const bandA: BandFile = { "id-A": { uuid: "id-A" } as OPVaultItem };
      mockedParseBandFile.mockReturnValueOnce(band0).mockReturnValueOnce(bandA);

      const result = await readAndParseBands(fakeSource);

      expect(result.size).toBe(2);
      expect(result.get("id-0")).toBe(band0["id-0"]);
      expect(result.get("id-A")).toBe(bandA["id-A"]);
    });

    it("should report progress via callback", async () => {
      mockedDiscoverBandLetters.mockResolvedValue(["0", "1", "2"]);
      mockedReadBandFileContent.mockResolvedValue("band content");
      mockedParseBandFile.mockReturnValue({});

      const progress: { loaded: number; total: number }[] = [];
      await readAndParseBands(fakeSource, (loaded, total) =>
        progress.push({ loaded, total }),
      );

      expect(progress).toEqual([
        { loaded: 1, total: 3 },
        { loaded: 2, total: 3 },
        { loaded: 3, total: 3 },
      ]);
    });

    it("should skip null band content", async () => {
      mockedDiscoverBandLetters.mockResolvedValue(["0", "1"]);
      mockedReadBandFileContent
        .mockResolvedValueOnce("band 0")
        .mockResolvedValueOnce(null);

      const band0: BandFile = { "id-0": { uuid: "id-0" } as OPVaultItem };
      mockedParseBandFile.mockReturnValueOnce(band0);

      const result = await readAndParseBands(fakeSource);

      expect(result.size).toBe(1);
      expect(result.get("id-0")).toBe(band0["id-0"]);
      expect(mockedParseBandFile).toHaveBeenCalledTimes(1);
    });

    it("should handle vault with no band files", async () => {
      mockedDiscoverBandLetters.mockResolvedValue([]);

      const result = await readAndParseBands(fakeSource);

      expect(result.size).toBe(0);
      expect(mockedReadBandFileContent).not.toHaveBeenCalled();
    });
  });
});
