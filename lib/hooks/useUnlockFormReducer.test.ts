import {
  unlockFormReducer,
  initialUnlockFormState,
  type UnlockFormState,
} from "@/lib/hooks/useUnlockFormReducer";

describe("unlockFormReducer", () => {
  it("returns initial state for unknown action", () => {
    const state = unlockFormReducer(
      initialUnlockFormState,
      // @ts-expect-error — testing unknown action type
      { type: "UNKNOWN" },
    );
    expect(state).toEqual(initialUnlockFormState);
  });

  describe("SET_PASSWORD", () => {
    it("sets password and clears error", () => {
      const prev: UnlockFormState = {
        ...initialUnlockFormState,
        error: "Incorrect password",
      };
      const next = unlockFormReducer(prev, {
        type: "SET_PASSWORD",
        password: "secret",
      });
      expect(next.password).toBe("secret");
      expect(next.error).toBe("");
    });

    it("preserves other fields", () => {
      const prev: UnlockFormState = {
        ...initialUnlockFormState,
        passwordHint: "fred",
        showHint: true,
      };
      const next = unlockFormReducer(prev, {
        type: "SET_PASSWORD",
        password: "x",
      });
      expect(next.passwordHint).toBe("fred");
      expect(next.showHint).toBe(true);
    });
  });

  describe("START_UNLOCK", () => {
    it("sets loading, clears error and progress", () => {
      const prev: UnlockFormState = {
        ...initialUnlockFormState,
        error: "some error",
        loadingProgress: { loaded: 3, total: 16 },
      };
      const next = unlockFormReducer(prev, { type: "START_UNLOCK" });
      expect(next.loading).toBe(true);
      expect(next.error).toBe("");
      expect(next.loadingProgress).toBeNull();
    });
  });

  describe("UNLOCK_FAILED_WRONG_PASSWORD", () => {
    it("sets error message and password hint", () => {
      const next = unlockFormReducer(initialUnlockFormState, {
        type: "UNLOCK_FAILED_WRONG_PASSWORD",
        passwordHint: "fred",
      });
      expect(next.error).toBe("Incorrect password");
      expect(next.passwordHint).toBe("fred");
      expect(next.showHint).toBe(false);
    });

    it("handles missing password hint", () => {
      const next = unlockFormReducer(initialUnlockFormState, {
        type: "UNLOCK_FAILED_WRONG_PASSWORD",
      });
      expect(next.error).toBe("Incorrect password");
      expect(next.passwordHint).toBeUndefined();
    });

    it("uses custom message when provided", () => {
      const next = unlockFormReducer(initialUnlockFormState, {
        type: "UNLOCK_FAILED_WRONG_PASSWORD",
        message: "Wrong credentials",
      });
      expect(next.error).toBe("Wrong credentials");
    });

    it("resets showHint to false", () => {
      const prev: UnlockFormState = {
        ...initialUnlockFormState,
        showHint: true,
      };
      const next = unlockFormReducer(prev, {
        type: "UNLOCK_FAILED_WRONG_PASSWORD",
        passwordHint: "hint",
      });
      expect(next.showHint).toBe(false);
    });
  });

  describe("UNLOCK_FAILED_GENERIC", () => {
    it("sets error message and clears password hint", () => {
      const prev: UnlockFormState = {
        ...initialUnlockFormState,
        passwordHint: "old hint",
      };
      const next = unlockFormReducer(prev, {
        type: "UNLOCK_FAILED_GENERIC",
        message: "Network error",
      });
      expect(next.error).toBe("Network error");
      expect(next.passwordHint).toBeUndefined();
    });
  });

  describe("UNLOCK_FINISHED", () => {
    it("clears loading, password, and progress", () => {
      const prev: UnlockFormState = {
        ...initialUnlockFormState,
        loading: true,
        password: "secret",
        loadingProgress: { loaded: 16, total: 16 },
      };
      const next = unlockFormReducer(prev, { type: "UNLOCK_FINISHED" });
      expect(next.loading).toBe(false);
      expect(next.password).toBe("");
      expect(next.loadingProgress).toBeNull();
    });

    it("preserves error and hint for display after unlock attempt", () => {
      const prev: UnlockFormState = {
        ...initialUnlockFormState,
        loading: true,
        error: "Incorrect password",
        passwordHint: "fred",
      };
      const next = unlockFormReducer(prev, { type: "UNLOCK_FINISHED" });
      expect(next.error).toBe("Incorrect password");
      expect(next.passwordHint).toBe("fred");
    });
  });

  describe("SET_LOADING_PROGRESS", () => {
    it("updates loading progress", () => {
      const next = unlockFormReducer(initialUnlockFormState, {
        type: "SET_LOADING_PROGRESS",
        progress: { loaded: 5, total: 16 },
      });
      expect(next.loadingProgress).toEqual({ loaded: 5, total: 16 });
    });
  });

  describe("SHOW_HINT", () => {
    it("sets showHint to true", () => {
      const next = unlockFormReducer(initialUnlockFormState, {
        type: "SHOW_HINT",
      });
      expect(next.showHint).toBe(true);
    });
  });

  describe("RESET", () => {
    it("returns to initial state", () => {
      const prev: UnlockFormState = {
        password: "secret",
        error: "something",
        passwordHint: "hint",
        showHint: true,
        loading: true,
        loadingProgress: { loaded: 10, total: 16 },
      };
      const next = unlockFormReducer(prev, { type: "RESET" });
      expect(next).toEqual(initialUnlockFormState);
    });
  });
});
