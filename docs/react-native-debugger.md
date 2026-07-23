---
sidebar_position: 2
title: React Native Debugger
---

# React Native Debugger

> This integration is in progress. The behavior and supported workflows described here may change as the feature is completed.

Reactotron is working toward a one-window debugging experience: use the Reactotron desktop app for its existing React Native tools and, where React Native makes it available, the JavaScript debugger. This does not replace native debugging tools or make every React Native runtime expose the same debugging surface.

## Runtime compatibility

| Runtime                                 | Reactotron Debugger availability                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| React Native 0.76+ with Hermes          | Source Explorer is available when Metro exposes a Hermes inspector target; breakpoint controls are the next phase.    |
| React Native 0.73–0.75 with Hermes      | Source Explorer is available on a best-effort basis when Metro exposes a compatible inspector target.                 |
| Older React Native versions with Hermes | Source Explorer is available only when Metro exposes a compatible inspector for the running app.                      |
| JavaScriptCore (JSC)                    | There is no equivalent embedded JavaScript debugger integration; use the platform's external debugging tools instead. |

For native code, breakpoints, and platform tooling, continue to use **Xcode** for iOS and **Android Studio** for Android.

## Connection requirements

The debugger needs all of the following:

- A running Metro server that is reachable from the app.
- A development build of the React Native app. Production builds are not supported for this workflow.
- A Reactotron connection from the app to the desktop app.

On Android, the device or emulator must be able to reach the development machine and Metro. For a USB-connected device or many Android emulators, reverse the relevant ports with `adb reverse`; Reactotron's default connection port is commonly forwarded with:

```sh
adb reverse tcp:9090 tcp:9090
```

If Metro is running on a port that the device cannot reach directly, make that Metro port accessible as well. The exact command depends on your Metro configuration and whether you are using a physical device, the Android Studio emulator, or another emulator.

When a device cannot use `localhost` to reach your computer, configure the app with the development machine's reachable IP address instead. See [Troubleshooting](./troubleshooting.md) for Reactotron connection details.

## What to expect today

The embedded Metro frontend has been removed. The Reactotron-native **Source Explorer** now reads the original project files and source text exposed through Metro/Hermes, with filtering and search inside the Debugger tab. Console and network activity remain in their existing Reactotron tabs.

Breakpoint controls, pause state, call stack, and variables are the next phase. They require a persistent, version-aware Hermes/CDP session and source-map translation from original files to the generated Metro bundle. Legacy Hermes inspector support still depends on what Metro exposes, and JSC does not provide an equivalent embedded JavaScript debugger. Keep using platform-native tools for native issues while this Reactotron feature evolves.
