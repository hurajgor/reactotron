# ![Reactotron Logo](./docs/plugins/images/readme/Reactotron-128.png) Reactotron

Reactotron is a desktop debugger for React and React Native. It brings application state, network traffic, logs, runtime UI, agent tools, and iOS Simulator control into one focused workspace.

![Reactotron desktop with Timeline and an embedded iPhone simulator](./docs/plugins/images/readme/desktop-simulator.png)

## What you can do

- Inspect network requests, responses, headers, payloads, and timing alongside application logs.
- Search and filter traffic by method, status, duration, content type, host, endpoint, time window, and duplicates.
- Explore React Native runtime UI through the Agent screen, using `testID`, labels, text, roles, and placeholders to find nodes and run supported actions.
- Connect coding agents through MCP for runtime inspection, UI actions, and desktop simulator workflows.
- Open and control iOS Simulators from Reactotron on macOS, without switching to Simulator.app.
- Open Android emulators and physical ADB devices directly in Reactotron.
- Choose a named theme, use a compact sidebar, and tailor the Timeline layout to your workflow.
- Debug the rest of your app with Reactotron’s established state, Redux, MobX-State-Tree, Async Storage, overlay, Storybook, benchmark, and custom-command tools.

## A modern desktop workspace

The Timeline is a single place to investigate API activity and logs. Keep the event list visible while inspecting details, resize the inspector to suit the task, and move between readable summary, request, response, headers, and raw data views.

![Timeline with simulator setup controls](./docs/plugins/images/readme/simulator-setup.png)

### Network and logs

Use the Timeline to:

- Search endpoints, logs, status codes, and hosts.
- Filter network events by method, status, duration, content type, host, endpoint, time window, and duplicates.
- Select log levels independently from network traffic.
- Inspect formatted, tree, or raw payloads and copy the data you need.
- Keep a resizable inspector open while you compare requests and responses.
- Capture `console.log`, `console.info`, `console.warn`, and `console.debug` calls without losing their additional arguments.

### Agentic development and MCP

The Agent screen and MCP server give people and coding agents a shared view of a connected React Native app. Inspect the runtime UI, find elements through `testID` or accessibility metadata, and perform supported interactions such as press, fill, and scroll. The MCP server also provides the app's debug data, state tools, and desktop iOS Simulator workflows to a local coding assistant.

See the [MCP guide](./docs/mcp.md) for client setup, redaction, available tools, and iOS Simulator requirements.

### Themes and layout

Choose Tokyo Night, T3 Code, Catppuccin, GitHub Dark, One Dark Pro, Nord, Rose Pine, Gruvbox Dark, or Ayu Mirage in Settings. The newer Timeline event-table interface and compact sidebar are enabled by default, and both preferences can be changed there.

![Reactotron Settings with theme, Timeline, and sidebar preferences](./docs/plugins/images/readme/desktop-settings.png)

## Embedded iOS Simulator (macOS)

Open the simulator panel to discover a booted iOS Simulator or create a new iPhone simulator from an installed runtime. Reactotron manages the local stream and gives you a first-class device surface with tabs, connection state, and device controls.

Requirements:

- macOS with Xcode Command Line Tools.
- At least one installed iOS Simulator runtime.

The embedded device supports Home, reload, reconnect, shutdown, rotation, light/dark appearance, pointer gestures, US-ASCII keyboard input, and paste. Screenshot capture offers **Save to File** or **Copy to Clipboard**. Recording begins immediately, displays a red **REC** state, and asks where to save only after you stop it.

| Shortcut      | Action                                                            |
| ------------- | ----------------------------------------------------------------- |
| `Cmd+S`       | Capture a screenshot and choose Save to File or Copy to Clipboard |
| `Cmd+R`       | Start recording; press again to stop and choose where to save     |
| `Cmd+Shift+A` | Toggle the simulator between light and dark appearance            |

## Android emulators and physical devices

The device panel discovers Android emulators, USB devices, and Wi-Fi ADB devices. Open one to see a live screenshot preview, tap the device, and use Back, Home, Recents, and Reload controls. Use the link button to run `adb reverse` for Reactotron's configured server port.

## Install

Download the desktop app from the [Releases](https://github.com/hurajgor/reactotron/releases) page for macOS, Linux, or Windows.

This fork publishes its client packages under the `@hurajgor` scope. Add the client that matches your application as a development dependency so it does not affect production builds:

```sh
# React Native
npm install --save-dev @hurajgor/reactotron-react-native

# React
npm install --save-dev @hurajgor/reactotron-react-js
```

Use the scoped `@hurajgor/*` integrations as well, for example `@hurajgor/reactotron-redux`, `@hurajgor/reactotron-mst`, and `@hurajgor/reactotron-apisauce`. Do not mix these with the unscoped upstream Reactotron packages.

## Get started

- [React Native quick start](./docs/quick-start/react-native.md)
- [React quick start](./docs/quick-start/react-js.md)
- [MCP setup and tools](./docs/mcp.md)
- [Tips and tricks](./docs/tips.md)
- [Troubleshooting](./docs/troubleshooting.md)

## Plugins and integrations

Reactotron includes integrations for [global errors](./docs/plugins/track-global-errors.md), [global logs](./docs/plugins/track-global-logs.md), [networking](./docs/plugins/networking.md), [Async Storage](./docs/plugins/async-storage.md), [React Native MMKV](./docs/plugins/react-native-mmkv.md), [benchmarks](./docs/plugins/benchmark.md), [apisauce](./docs/plugins/apisauce.md), [overlays](./docs/plugins/overlay.md), [MST](./docs/plugins/mst.md), [Redux](./docs/plugins/redux.md), [Open in Editor](./docs/plugins/open-in-editor.md), [Storybook](./docs/plugins/storybook.md), and [custom commands](./docs/custom-commands.md).

## Contributing

- [Contributing guide](./docs/contributing/index.md)
- [Architecture](./docs/contributing/architecture.md)
- [Monorepo guide](./docs/contributing/monorepo.md)
- [Release process](./docs/contributing/releasing.md)

The desktop development app identifies itself as **Reactotron Dev** and uses ports `9091` (server) and `4568` (MCP) by default, so it can run alongside a release installation. Override either with `REACTOTRON_SERVER_PORT` or `REACTOTRON_MCP_PORT` when needed.

## Credits

Reactotron is developed by [Infinite Red](https://infinite.red), [@rmevans9](https://github.com/rmevans9), and 70+ contributors. Special thanks to [@skellock](https://github.com/skellock) for originally creating Reactotron while at Infinite Red.
