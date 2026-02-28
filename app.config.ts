import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...(config as ExpoConfig),
    extra: {
      ...config.extra,
      dropboxAppKey: process.env.DROPBOX_APP_KEY ?? null,
    },
  };
};
