import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

/**
 * OAuth callback route.
 *
 * When Dropbox redirects back to exp+unoskeleton://oauth/callback (or
 * unoskeleton://oauth/callback in production), Expo Router navigates here.
 * The actual token exchange is handled by expo-auth-session's
 * Linking.addEventListener callback independently — this route just
 * prevents an "unmatched route" error and pops itself off the stack
 * so the user returns to the screen that initiated the auth flow.
 */
export default function OAuthCallback() {
  useEffect(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/lock");
    }
  }, []);

  return <View />;
}
