// Initialize crypto polyfills (must be first import)
import tamaguiConfig from "../tamagui.config";
import LockOverlay from "@/lib/components/LockOverlay";
import {
  AutoLockProvider,
  useAutoLockContext,
} from "@/lib/contexts/AutoLockContext";
import { useAppActive } from "@/lib/hooks/useAppActive";
import { usePreventScreenCapture } from "@/lib/hooks/usePreventScreenCapture";
import "@/lib/polyfills";
import { Stack } from "expo-router";
import { View, StyleSheet } from "react-native";
import { TamaguiProvider } from "tamagui";

export default function RootLayout() {
  usePreventScreenCapture();

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AutoLockProvider>
        <RootLayoutContent />
      </AutoLockProvider>
    </TamaguiProvider>
  );
}

function RootLayoutContent() {
  const { autoLocked, clearAutoLock } = useAutoLockContext();
  const isActive = useAppActive();

  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false }} />
      {autoLocked && <LockOverlay onUnlock={clearAutoLock} />}
      {!isActive && <View style={styles.privacyOverlay} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  privacyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    zIndex: 9999,
  },
});
