# UnoSkeleton

A read-only [OPVault](https://support.1password.com/opvault-design/) viewer for Android. Decrypt and browse your existing 1Password vaults on mobile.

## Features

- Read-only OPVault format support (decrypt and view existing vaults)
- AES-256-CBC encryption with HMAC-SHA256 authentication
- PBKDF2-HMAC-SHA512 key derivation
- Lazy decryption (item details only decrypted when viewed)
- Dropbox cloud sync (optional)
- Biometric unlock
- Auto-lock with configurable timeout

## Building

### Prerequisites

- Node.js 22+
- Java 17 (Zulu JDK recommended)
- Android SDK

### Development

```bash
npm install
npm start              # Start Expo dev server
npm run android        # Run on Android device/emulator
```

### Release APK

```bash
npm install
npx expo prebuild --platform android --no-install
cd android && ./gradlew app:assembleRelease --no-daemon
```

The APK will be at `android/app/build/outputs/apk/release/app-release.apk`.

To sign the release, place your keystore at `android/app/release.keystore` and set these environment variables before building:

```bash
export KEYSTORE_PASSWORD=<your-keystore-password>
export KEY_ALIAS=<your-key-alias>
export KEY_PASSWORD=<your-key-password>
```

### Testing

```bash
npm test               # Run all tests
npm run lint           # ESLint
npm run format:check   # Prettier check
```

## Dropbox Sync

The app can sync vaults from Dropbox. To enable this:

1. Go to the [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Click **Create app**
3. Choose **Scoped access** and **Full Dropbox** access type
4. Name your app and click **Create app**
5. Under **Permissions**, enable `files.metadata.read` and `files.content.read`
6. Under **Settings**, note your **App key**

You can provide the app key in two ways:

- **Build time:** Set the `DROPBOX_APP_KEY` environment variable before running `expo prebuild`
- **Runtime:** Enter the app key in the app's settings screen

## OPVault Specification

This app implements the [OPVault design specification](https://support.1password.com/opvault-design/) for reading 1Password vault data.

## License

Business Source License (BSL). See [LICENSE.md](LICENSE.md) for details.
