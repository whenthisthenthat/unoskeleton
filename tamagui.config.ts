import { config } from "@tamagui/config/v3";
import { createTamagui } from "tamagui";

const tamaguiConfig = createTamagui(config);

export type Conf = typeof tamaguiConfig;

declare module "tamagui" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends Conf {}
}

export default tamaguiConfig;
