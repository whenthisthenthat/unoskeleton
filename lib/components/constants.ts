import { Platform } from "react-native";

export const MONO_FONT = Platform.select({
  ios: "Menlo",
  default: "monospace",
});

export const MASKED_VALUE =
  "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
