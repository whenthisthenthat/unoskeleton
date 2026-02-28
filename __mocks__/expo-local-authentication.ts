/**
 * Jest module mock for expo-local-authentication
 *
 * Auto-discovered by Jest when tests call jest.mock("expo-local-authentication").
 */

export enum AuthenticationType {
  FINGERPRINT = 1,
  FACIAL_RECOGNITION = 2,
  IRIS = 3,
}

export const hasHardwareAsync = jest.fn<Promise<boolean>, []>();
export const isEnrolledAsync = jest.fn<Promise<boolean>, []>();
export const supportedAuthenticationTypesAsync = jest.fn<
  Promise<AuthenticationType[]>,
  []
>();
export const authenticateAsync = jest.fn<
  Promise<{ success: boolean }>,
  [object?]
>();
