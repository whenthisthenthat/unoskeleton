import { useLockVault } from "@/lib/hooks/useLockVault";
import { useVaultSubscription } from "@/lib/hooks/useVaultSubscription";
import { requestManualSync } from "@/lib/vault/vault-instance";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  GestureResponderEvent,
  Modal,
  Pressable,
  StyleSheet,
} from "react-native";
import { YStack, XStack, Text, useTheme } from "tamagui";

/**
 * Hamburger Menu Component
 *
 * Displays a hamburger menu icon that opens a dropdown menu with actions:
 * - Sync: Syncs vault from original source
 * - Lock: Locks the vault and navigates to lock screen
 * - Close: Dismisses the menu
 *
 * The menu can be closed by:
 * 1. Tapping the Close menu item
 * 2. Tapping outside the menu (on the overlay)
 */
export default function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { lockVaultAndNavigate } = useLockVault();
  const { loadingProgress } = useVaultSubscription();
  const syncDisabled = loadingProgress !== null;
  const theme = useTheme();

  const handleToggleMenu = () => {
    setIsOpen((prev) => !prev);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleLock = () => {
    setIsOpen(false);
    lockVaultAndNavigate();
  };

  const handleSync = () => {
    setIsOpen(false);
    requestManualSync().catch((err) => {});
  };

  return (
    <>
      {/* Hamburger Icon Button */}
      <Pressable onPress={handleToggleMenu}>
        <Ionicons name="menu" size={28} color={theme.blue10.get()} />
      </Pressable>

      {/* Dropdown Menu */}
      <Modal
        transparent
        visible={isOpen}
        animationType="none"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <YStack
            position="absolute"
            top={60}
            right={16}
            backgroundColor="$background"
            borderRadius={12}
            padding="$2"
            width={200}
            shadowColor="$shadowColor"
            shadowOffset={{ width: 0, height: 2 }}
            shadowOpacity={0.25}
            shadowRadius={8}
            elevation={5}
            onPress={(e: GestureResponderEvent) => {
              e.stopPropagation();
            }}
          >
            {/* Sync Menu Item */}
            <Pressable
              onPress={handleSync}
              disabled={syncDisabled}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: theme.gray3.get() },
                syncDisabled && styles.disabledItem,
              ]}
            >
              <XStack alignItems="center" gap="$3" padding="$3">
                <Ionicons
                  name="sync"
                  size={24}
                  color={syncDisabled ? theme.gray8.get() : theme.blue10.get()}
                />
                <Text fontSize={16} color={syncDisabled ? "$gray8" : "$color"}>
                  Sync
                </Text>
              </XStack>
            </Pressable>

            {/* Lock Menu Item */}
            <Pressable
              onPress={handleLock}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: theme.gray3.get() },
              ]}
            >
              <XStack alignItems="center" gap="$3" padding="$3">
                <Ionicons
                  name="lock-closed"
                  size={24}
                  color={theme.blue10.get()}
                />
                <Text fontSize={16}>Lock</Text>
              </XStack>
            </Pressable>

            {/* Close Menu Item */}
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: theme.gray3.get() },
              ]}
            >
              <XStack alignItems="center" gap="$3" padding="$3">
                <Ionicons name="close" size={24} color={theme.blue10.get()} />
                <Text fontSize={16}>Close</Text>
              </XStack>
            </Pressable>
          </YStack>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  menuItem: {
    borderRadius: 8,
  },
  disabledItem: {
    opacity: 0.6,
  },
});
