import type { LoadingProgress } from "@/lib/vault/types";
import { useReducer } from "react";

export interface UnlockFormState {
  password: string;
  error: string;
  passwordHint: string | undefined;
  showHint: boolean;
  loading: boolean;
  loadingProgress: LoadingProgress | null;
}

export type UnlockFormAction =
  | { type: "SET_PASSWORD"; password: string }
  | { type: "START_UNLOCK" }
  | {
      type: "UNLOCK_FAILED_WRONG_PASSWORD";
      passwordHint?: string;
      message?: string;
    }
  | { type: "UNLOCK_FAILED_GENERIC"; message: string }
  | { type: "UNLOCK_FINISHED" }
  | { type: "SET_LOADING_PROGRESS"; progress: LoadingProgress }
  | { type: "SHOW_HINT" }
  | { type: "RESET" };

export const initialUnlockFormState: UnlockFormState = {
  password: "",
  error: "",
  passwordHint: undefined,
  showHint: false,
  loading: false,
  loadingProgress: null,
};

export function unlockFormReducer(
  state: UnlockFormState,
  action: UnlockFormAction,
): UnlockFormState {
  switch (action.type) {
    case "SET_PASSWORD":
      return { ...state, password: action.password, error: "" };
    case "START_UNLOCK":
      return { ...state, loading: true, error: "", loadingProgress: null };
    case "UNLOCK_FAILED_WRONG_PASSWORD":
      return {
        ...state,
        error: action.message ?? "Incorrect password",
        passwordHint: action.passwordHint,
        showHint: false,
      };
    case "UNLOCK_FAILED_GENERIC":
      return { ...state, error: action.message, passwordHint: undefined };
    case "UNLOCK_FINISHED":
      return { ...state, loading: false, password: "", loadingProgress: null };
    case "SET_LOADING_PROGRESS":
      return { ...state, loadingProgress: action.progress };
    case "SHOW_HINT":
      return { ...state, showHint: true };
    case "RESET":
      return initialUnlockFormState;
    default:
      return state;
  }
}

export function useUnlockForm() {
  return useReducer(unlockFormReducer, initialUnlockFormState);
}
