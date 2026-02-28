/**
 * Global polyfills for React Native
 * Import this file early in the app initialization (e.g., in _layout.tsx)
 */
import { install } from "react-native-quick-crypto";

// Install crypto polyfills (including Buffer)
install();
