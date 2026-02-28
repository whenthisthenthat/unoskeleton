import { ColorCodedText } from "@/lib/components/ColorCodedText";
import { CopyIndicator } from "@/lib/components/CopyIndicator";
import { DetailRow } from "@/lib/components/DetailRow";
import { FieldLabel } from "@/lib/components/FieldLabel";
import { LargeTextModal } from "@/lib/components/LargeTextModal";
import { MASKED_VALUE, MONO_FONT } from "@/lib/components/constants";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";
import type { DisplayField } from "@/lib/vault/types";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text as RNText } from "react-native";
import Markdown, { MarkdownIt } from "react-native-markdown-display";
import type { RenderRules } from "react-native-markdown-display";
import { XStack, YStack, Text, useTheme } from "tamagui";

const mdParser = MarkdownIt({ typographer: true, linkify: true });

const selectableRules: RenderRules = {
  link: (node, children, _parent, styles) => (
    <RNText
      key={node.key}
      style={styles.link}
      onPress={() => Linking.openURL(node.attributes.href)}
    >
      {children}
    </RNText>
  ),
  textgroup: (node, children, _parent, styles) => (
    <RNText key={node.key} style={styles.textgroup} selectable>
      {children}
    </RNText>
  ),
  code_block: (node, _children, _parent, styles, inheritedStyles = {}) => {
    let { content } = node;
    if (typeof content === "string" && content.endsWith("\n")) {
      content = content.slice(0, -1);
    }
    return (
      <RNText
        key={node.key}
        style={[inheritedStyles, styles.code_block]}
        selectable
      >
        {content}
      </RNText>
    );
  },
  fence: (node, _children, _parent, styles, inheritedStyles = {}) => {
    let { content } = node;
    if (typeof content === "string" && content.endsWith("\n")) {
      content = content.slice(0, -1);
    }
    return (
      <RNText key={node.key} style={[inheritedStyles, styles.fence]} selectable>
        {content}
      </RNText>
    );
  },
};

interface DetailFieldRowProps {
  field: DisplayField;
}

export function DetailFieldRow({ field }: DetailFieldRowProps) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);
  const [showLargeText, setShowLargeText] = useState(false);
  const { copied, handleCopy } = useCopyToClipboard(field.value);

  const displayValue =
    field.sensitive && !revealed ? MASKED_VALUE : field.value;

  const isLinkable =
    field.kind === "url" || field.kind === "email" || field.kind === "phone";

  const handleLinkPress = () => {
    if (field.kind === "url") {
      const url = field.value.startsWith("http")
        ? field.value
        : `https://${field.value}`;
      Linking.openURL(url);
    } else if (field.kind === "email") {
      Linking.openURL(`mailto:${field.value}`);
    } else if (field.kind === "phone") {
      Linking.openURL(`tel:${field.value}`);
    }
  };

  const mdStyles = useMemo(
    () =>
      field.kind !== "note"
        ? undefined
        : StyleSheet.create({
            body: { color: theme.color.get(), fontSize: 15, lineHeight: 22 },
            heading1: {
              color: theme.color.get(),
              fontSize: 22,
              fontWeight: "700",
            },
            heading2: {
              color: theme.color.get(),
              fontSize: 19,
              fontWeight: "600",
            },
            heading3: {
              color: theme.color.get(),
              fontSize: 17,
              fontWeight: "600",
            },
            link: { color: theme.blue10.get() },
            blockquote: {
              borderLeftColor: theme.gray8.get(),
              backgroundColor: "transparent",
              paddingLeft: 12,
            },
            code_inline: {
              fontFamily: MONO_FONT,
              backgroundColor: theme.gray4.get(),
              color: theme.color.get(),
            },
            fence: {
              fontFamily: MONO_FONT,
              backgroundColor: theme.gray4.get(),
              color: theme.color.get(),
            },
            bullet_list_icon: { color: theme.color.get() },
            ordered_list_icon: { color: theme.color.get() },
          }),
    [field.kind, theme],
  );

  return (
    <DetailRow onPress={field.kind !== "note" ? handleCopy : undefined}>
      <YStack flex={1} gap="$1">
        <FieldLabel>{field.label}</FieldLabel>
        {field.kind === "note" ? (
          <Markdown
            style={mdStyles}
            rules={selectableRules}
            markdownit={mdParser}
          >
            {field.value}
          </Markdown>
        ) : field.sensitive && revealed ? (
          <ColorCodedText value={field.value} fontSize={16} />
        ) : (
          <Text
            fontSize="$4"
            color={isLinkable && !field.sensitive ? "$blue10" : "$color"}
            onPress={
              isLinkable && !field.sensitive ? handleLinkPress : undefined
            }
          >
            {displayValue}
          </Text>
        )}
      </YStack>

      <XStack gap="$3" alignItems="center">
        {field.sensitive && (
          <>
            <Pressable onPress={() => setRevealed((r) => !r)}>
              <Ionicons
                name={revealed ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.gray9.get()}
              />
            </Pressable>
            <Pressable onPress={() => setShowLargeText(true)}>
              <Ionicons
                name="expand-outline"
                size={20}
                color={theme.gray9.get()}
              />
            </Pressable>
          </>
        )}
        {field.kind !== "note" && <CopyIndicator copied={copied} />}
      </XStack>

      {field.sensitive && (
        <LargeTextModal
          visible={showLargeText}
          onClose={() => setShowLargeText(false)}
          label={field.label}
          value={field.value}
          onCopy={handleCopy}
          copied={copied}
        />
      )}
    </DetailRow>
  );
}
