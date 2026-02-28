import { useAutoLockContext } from "@/lib/contexts/AutoLockContext";
import { useSyncToast } from "@/lib/hooks/useSyncToast";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";

export default function TabLayout() {
  const { handleTouchCapture } = useAutoLockContext();
  useSyncToast();

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={handleTouchCapture}
    >
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#007AFF",
          popToTopOnBlur: true,
        }}
      >
        <Tabs.Screen
          name="favourites"
          options={{
            title: "Favourites",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="heart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="categories"
          options={{
            title: "Categories",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tags"
          options={{
            title: "Tags",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="pricetag" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
