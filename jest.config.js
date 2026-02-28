const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

const baseConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    ...tsJestTransformCfg,
  },
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|react-native-quick-crypto|react-native-nitro-modules|@react-native|expo-file-system)/)",
  ],
  moduleNameMapper: {
    "^react-native$": "<rootDir>/node_modules/react-native",
    "^@/(.*)$": "<rootDir>/$1",
  },
};

/** @type {import("jest").Config} **/
module.exports = {
  projects: [
    {
      ...baseConfig,
      displayName: "unit",
      testEnvironment: "node",
      testPathIgnorePatterns: [
        "<rootDir>/lib/hooks/useBiometricUnlock\\.test\\.ts$",
        "<rootDir>/lib/contexts/AutoLockContext\\.test\\.ts$",
      ],
    },
    {
      ...baseConfig,
      displayName: "hooks",
      testEnvironment: "jsdom",
      testMatch: [
        "<rootDir>/lib/hooks/useBiometricUnlock.test.ts",
        "<rootDir>/lib/contexts/AutoLockContext.test.ts",
      ],
    },
  ],
};
