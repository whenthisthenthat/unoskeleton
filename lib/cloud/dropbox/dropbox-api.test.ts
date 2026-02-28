import {
  listFolder,
  downloadFileText,
  downloadFileBinary,
  getMetadata,
  TokenExpiredError,
  DropboxApiError,
} from "./dropbox-api";

// Mock global fetch
const mockFetch = jest.fn<
  Promise<Response>,
  [RequestInfo | URL, RequestInit?]
>();
global.fetch = mockFetch;

function mockResponse(status: number, body: unknown, ok?: boolean): Response {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: () => Promise.resolve(body),
    text: () =>
      Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    arrayBuffer: () =>
      Promise.resolve(
        body instanceof ArrayBuffer
          ? body
          : new TextEncoder().encode(JSON.stringify(body)).buffer,
      ),
  } as Response;
}

describe("dropbox-api", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("listFolder", () => {
    it("should return entries from a folder", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, {
          entries: [
            {
              ".tag": "file",
              name: "profile.js",
              path_lower: "/vault/profile.js",
              path_display: "/vault/profile.js",
            },
            {
              ".tag": "folder",
              name: "subfolder",
              path_lower: "/vault/subfolder",
              path_display: "/vault/subfolder",
            },
          ],
          cursor: "cursor1",
          has_more: false,
        }),
      );

      const entries = await listFolder("token123", "/vault");

      expect(entries).toHaveLength(2);
      expect(entries[0].name).toBe("profile.js");
      expect(entries[1].name).toBe("subfolder");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.dropboxapi.com/2/files/list_folder",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            path: "/vault",
            include_non_downloadable_files: false,
          }),
        }),
      );
    });

    it("should convert root path '/' to empty string", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, { entries: [], cursor: "c", has_more: false }),
      );

      await listFolder("token", "/");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            path: "",
            include_non_downloadable_files: false,
          }),
        }),
      );
    });

    it("should handle pagination", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockResponse(200, {
            entries: [
              {
                ".tag": "file",
                name: "a.js",
                path_lower: "/a.js",
                path_display: "/a.js",
              },
            ],
            cursor: "cursor1",
            has_more: true,
          }),
        )
        .mockResolvedValueOnce(
          mockResponse(200, {
            entries: [
              {
                ".tag": "file",
                name: "b.js",
                path_lower: "/b.js",
                path_display: "/b.js",
              },
            ],
            cursor: "cursor2",
            has_more: false,
          }),
        );

      const entries = await listFolder("token", "/vault");

      expect(entries).toHaveLength(2);
      expect(entries[0].name).toBe("a.js");
      expect(entries[1].name).toBe("b.js");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw TokenExpiredError on 401", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(401, "Unauthorized", false));

      await expect(listFolder("bad-token", "/vault")).rejects.toThrow(
        TokenExpiredError,
      );
    });

    it("should return empty array on 409 not_found", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(409, { error_summary: "path/not_found/." }, false),
      );

      const entries = await listFolder("token", "/nonexistent");

      expect(entries).toEqual([]);
    });
  });

  describe("downloadFileText", () => {
    it("should return file content as text", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("var profile = {};"),
      } as Response);

      const content = await downloadFileText("token", "/vault/profile.js");

      expect(content).toBe("var profile = {};");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://content.dropboxapi.com/2/files/download",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer token",
            "Dropbox-API-Arg": JSON.stringify({ path: "/vault/profile.js" }),
          }),
        }),
      );
    });

    it("should return null on 409", async () => {
      mockFetch.mockResolvedValueOnce({ status: 409 } as Response);

      const content = await downloadFileText("token", "/missing.js");

      expect(content).toBeNull();
    });

    it("should throw TokenExpiredError on 401", async () => {
      mockFetch.mockResolvedValueOnce({ status: 401 } as Response);

      await expect(downloadFileText("bad-token", "/file.js")).rejects.toThrow(
        TokenExpiredError,
      );
    });
  });

  describe("downloadFileBinary", () => {
    it("should return file content as Uint8Array", async () => {
      const bytes = new Uint8Array([0x01, 0x02, 0x03]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(bytes.buffer),
      } as Response);

      const content = await downloadFileBinary(
        "token",
        "/vault/file.attachment",
      );

      expect(content).toEqual(bytes);
    });

    it("should return null on 409", async () => {
      mockFetch.mockResolvedValueOnce({ status: 409 } as Response);

      const content = await downloadFileBinary("token", "/missing.attachment");

      expect(content).toBeNull();
    });
  });

  describe("getMetadata", () => {
    it("should return metadata with content_hash", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, {
          ".tag": "file",
          name: "profile.js",
          path_lower: "/vault/profile.js",
          content_hash: "abc123hash",
        }),
      );

      const meta = await getMetadata("token", "/vault/profile.js");

      expect(meta).toEqual(
        expect.objectContaining({
          name: "profile.js",
          content_hash: "abc123hash",
        }),
      );
    });

    it("should return null on not_found", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(409, { error_summary: "path/not_found/." }, false),
      );

      const meta = await getMetadata("token", "/missing");

      expect(meta).toBeNull();
    });

    it("should throw DropboxApiError on other 409 errors", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(409, { error_summary: "path/malformed_path/." }, false),
      );

      await expect(getMetadata("token", "bad/path")).rejects.toThrow(
        DropboxApiError,
      );
    });
  });
});
