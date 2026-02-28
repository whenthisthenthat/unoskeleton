import { storeToken, getToken, clearToken } from "./token-store";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store");

const MockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe("token-store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("storeToken", () => {
    it("should store token data as JSON under provider key", async () => {
      await storeToken("dropbox", {
        accessToken: "abc",
        refreshToken: "xyz",
        expiresAt: 1000,
      });

      expect(MockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "cloud_token_dropbox",
        JSON.stringify({
          accessToken: "abc",
          refreshToken: "xyz",
          expiresAt: 1000,
        }),
      );
    });

    it("should store token without optional fields", async () => {
      await storeToken("icloud", { accessToken: "token123" });

      expect(MockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "cloud_token_icloud",
        JSON.stringify({ accessToken: "token123" }),
      );
    });
  });

  describe("getToken", () => {
    it("should return parsed token data", async () => {
      MockSecureStore.getItemAsync.mockResolvedValue(
        JSON.stringify({ accessToken: "abc", refreshToken: "xyz" }),
      );

      const token = await getToken("dropbox");

      expect(token).toEqual({ accessToken: "abc", refreshToken: "xyz" });
      expect(MockSecureStore.getItemAsync).toHaveBeenCalledWith(
        "cloud_token_dropbox",
      );
    });

    it("should return null when no token stored", async () => {
      MockSecureStore.getItemAsync.mockResolvedValue(null);

      const token = await getToken("dropbox");

      expect(token).toBeNull();
    });

    it("should return null on error", async () => {
      MockSecureStore.getItemAsync.mockRejectedValue(
        new Error("SecureStore unavailable"),
      );

      const token = await getToken("dropbox");

      expect(token).toBeNull();
    });
  });

  describe("clearToken", () => {
    it("should delete token from SecureStore", async () => {
      await clearToken("dropbox");

      expect(MockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "cloud_token_dropbox",
      );
    });
  });
});
