import {
  getStoredDropboxAppKey,
  setStoredDropboxAppKey,
} from "@/lib/cloud/dropbox/dropbox-app-key-store";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { Pressable } from "react-native";
import { YStack, XStack, Button, Text, H4, Input } from "tamagui";

export default function DropboxKeySection() {
  const [appKey, setAppKeyState] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [keyInput, setKeyInput] = useState("");

  useEffect(() => {
    getStoredDropboxAppKey().then(setAppKeyState);
  }, []);

  const handleEdit = () => {
    setKeyInput(appKey ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    await setStoredDropboxAppKey(trimmed);
    setAppKeyState(trimmed);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setKeyInput("");
  };

  return (
    <YStack gap="$2">
      <H4>Dropbox</H4>
      <Text fontSize="$2" color="$gray10">
        App Key used for Dropbox OAuth authentication
      </Text>
      {editing ? (
        <YStack gap="$2">
          <Input
            size="$4"
            placeholder="App Key"
            value={keyInput}
            onChangeText={setKeyInput}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <XStack gap="$2">
            <Button
              flex={1}
              size="$3"
              variant="outlined"
              onPress={handleCancel}
            >
              Cancel
            </Button>
            <Button
              flex={1}
              size="$3"
              theme="active"
              onPress={handleSave}
              disabled={!keyInput.trim()}
            >
              Save
            </Button>
          </XStack>
        </YStack>
      ) : (
        <Pressable onPress={handleEdit}>
          <XStack
            paddingVertical="$3"
            paddingHorizontal="$2"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text fontSize="$4" color={appKey ? "$color" : "$gray10"}>
              {appKey ? "Configured" : "Not set"}
            </Text>
            <XStack alignItems="center" gap="$2">
              <Text fontSize="$3" color="$blue10">
                {appKey ? "Edit" : "Set"}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#007AFF" />
            </XStack>
          </XStack>
        </Pressable>
      )}
    </YStack>
  );
}
