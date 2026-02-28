import {
  getAutoLockTimeout,
  setAutoLockTimeout,
  subscribeToTimeoutChange,
  DEFAULT_AUTO_LOCK_TIMEOUT,
} from "@/lib/vault/auto-lock-store";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store");

const mockGet = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const mockSet = SecureStore.setItemAsync as jest.MockedFunction<
  typeof SecureStore.setItemAsync
>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getAutoLockTimeout", () => {
  it("returns default when no stored value", async () => {
    mockGet.mockResolvedValue(null);
    expect(await getAutoLockTimeout()).toBe(DEFAULT_AUTO_LOCK_TIMEOUT);
  });

  it("returns stored numeric value", async () => {
    mockGet.mockResolvedValue("60000");
    expect(await getAutoLockTimeout()).toBe(60_000);
  });

  it("returns null (disabled) when stored", async () => {
    mockGet.mockResolvedValue("null");
    expect(await getAutoLockTimeout()).toBeNull();
  });

  it("returns default on SecureStore error", async () => {
    mockGet.mockRejectedValue(new Error("unavailable"));
    expect(await getAutoLockTimeout()).toBe(DEFAULT_AUTO_LOCK_TIMEOUT);
  });
});

describe("setAutoLockTimeout", () => {
  it("persists numeric value to SecureStore", async () => {
    await setAutoLockTimeout(60_000);
    expect(mockSet).toHaveBeenCalledWith("autoLockTimeout", "60000");
  });

  it("persists null (disabled) to SecureStore", async () => {
    await setAutoLockTimeout(null);
    expect(mockSet).toHaveBeenCalledWith("autoLockTimeout", "null");
  });

  it("notifies subscribed listeners", async () => {
    const listener = jest.fn();
    subscribeToTimeoutChange(listener);

    await setAutoLockTimeout(30_000);

    expect(listener).toHaveBeenCalledWith(30_000);
  });

  it("does not notify after unsubscribe", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToTimeoutChange(listener);
    unsubscribe();

    await setAutoLockTimeout(30_000);

    expect(listener).not.toHaveBeenCalled();
  });
});
