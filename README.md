# ![Reactotron Logo](./docs/plugins/images/readme/Reactotron-128.png)

[Join our Community Slack](http://community.infinite.red/)

## Introduction

Reactotron is a powerful debugger for React and React Native applications. It provides an easy-to-use interface for developers to monitor their application's **state, network requests, and performance metrics** and can be used for any size of project, from small personal apps to large-scale enterprise applications. The OG debugger at [Infinite Red](https://infinite.red) that we use on a day-to-day basis to build client apps. Additionally, Reactotron is completely open source and free to use, making it an invaluable tool for developers at all levels of experience.

We recommend that you watch [Darin Wilson's](https://github.com/darinwilson) talk at [Chain React](https://chainreactconf.com/): [Chain React 2018: Debugging and Beyond with Reactotron](https://www.youtube.com/watch?v=UiPo9A9k7xc)!

## Reactotron Superpowers

Use Reactotron to:

- view your application state
- show API requests & responses
- perform quick performance benchmarks
- subscribe to parts of your application state
- display messages similar to `console.log`
- track global errors with source-mapped stack traces including saga stack traces!
- dispatch actions like a government-run mind control experiment
- hot swap your app's state using Redux or mobx-state-tree
- show image overlay in React Native
- track your Async Storage in React Native
- inspect, search, and filter network requests alongside application logs
- inspect React Native runtime nodes and run supported actions from the Agent screen
- control connected iOS Simulators directly from the desktop app on macOS
- connect coding agents through MCP for runtime and simulator workflows

You plug it into your app as a dev dependency so it adds nothing to your production builds.

### Desktop

Reactotron on the left, demo React Native app on the right.

![Desktop](./docs/plugins/images/readme/reactotron-demo-app.gif)

### Desktop tools

#### Network and logs

The Network screen brings API traffic and Reactotron logs into one workspace. Search requests and logs, filter traffic by method, status, duration, content type, host, endpoint, time window, or duplicates, and inspect request, response, headers, and raw payloads without losing your place in the event list.

#### Agent and MCP

The Agent screen can request a runtime snapshot from a connected React Native app, search nodes by `testID`, label, text, role, or placeholder, then run supported press and fill actions. Reactotron's MCP server exposes the same runtime capabilities to coding agents, along with desktop-host controls when the desktop app is available. See the [MCP guide](./docs/mcp.md) for setup and available tools.

#### Embedded iOS Simulator (macOS)

Open the simulator panel from the desktop app to work with a booted iOS Simulator without switching to Simulator.app. Reactotron can discover available simulators, create an iPhone simulator from an installed runtime, boot and stream it locally, and provide device controls in the panel.

Requirements: macOS with Xcode Command Line Tools and at least one installed iOS Simulator runtime.

The embedded surface supports Home, reload, reconnect, shutdown, rotation, screenshots, screen recording, pointer gestures, keyboard input, and paste. Screenshot capture offers **Save to File** or **Copy to Clipboard**. Recording starts immediately, shows a red **REC** state, and asks for a destination only after you stop it.

| Shortcut      | Action                                                            |
| ------------- | ----------------------------------------------------------------- |
| `Cmd+S`       | Capture a screenshot and choose Save to File or Copy to Clipboard |
| `Cmd+R`       | Start recording; press again to stop and choose where to save     |
| `Cmd+Shift+A` | Toggle the simulator appearance between light and dark            |

Keyboard input uses the US-ASCII keyboard mapping supported by the local simulator stream.

## Installation

On the [Releases](https://github.com/infinitered/reactotron/releases?q=reactotron-app&expanded=true) page, navigate to the latest `reactotron-app` release to find the newest version of:

- macOS (x64 & arm64)
- Linux (32-bit & 64-bit)
- Windows (32-bit & 64-bit)

## How to setup Reactotron in our app

- [**React Native**](https://docs.infinite.red/reactotron/quick-start/react-native/)
- [**React**](https://docs.infinite.red/reactotron/quick-start/react-js/)

## How to use Reactotron's features/plugins

- [**Track Global Errors**](https://docs.infinite.red/reactotron/plugins/track-global-errors/)
- [**Track Global Logs**](https://docs.infinite.red/reactotron/plugins/track-global-logs/)
- [**Networking**](https://docs.infinite.red/reactotron/plugins/networking/)
- [**Async Storage**](https://docs.infinite.red/reactotron/plugins/async-storage/)
- [**React Native MMKV**](https://docs.infinite.red/reactotron/plugins/react-native-mmkv/)
- [**Benchmark**](https://docs.infinite.red/reactotron/plugins/benchmark/)
- [**apisauce**](https://docs.infinite.red/reactotron/plugins/apisauce/)
- [**Overlay**](https://docs.infinite.red/reactotron/plugins/overlay/)
- [**MST**](https://docs.infinite.red/reactotron/plugins/mst/)
- [**Redux**](https://docs.infinite.red/reactotron/plugins/redux/)
- [**Open in Editor**](https://docs.infinite.red/reactotron/plugins/open-in-editor/)
- [**Storybook (only for React Native)**](https://docs.infinite.red/reactotron/plugins/storybook/) \
   `reactotron-react-native` ships with [Storybook](https://storybook.js.org/).
  This enables you to switch to Storybook from the Reactotron app.
- [**Custom Commands**](https://docs.infinite.red/reactotron/custom-commands/)

## Tips and Tricks

[Some tips that will elevate your Reactotron experience.](https://docs.infinite.red/reactotron/tips/)

## Bug Reports

When reporting problems with Reactotron, use the provided example app located in `app/example-app` to replicate the issue. This approach enables us to isolate and expedite the resolution of the problem.

## Want to contribute? Here are some helpful reading materials

- [**Contributing**](https://docs.infinite.red/reactotron/contributing/)
- [**Architecture**](https://docs.infinite.red/reactotron/contributing/architecture/)
- [**Monorepo**](https://docs.infinite.red/reactotron/contributing/monorepo/)
- [**Release**](https://docs.infinite.red/reactotron/contributing/releasing/)

## Troubleshooting

- [**React Native iOS**](https://docs.infinite.red/reactotron/troubleshooting/#react-native-ios)
- [**React Native Android**](https://docs.infinite.red/reactotron/troubleshooting/#react-native-android)

## Credits

Reactotron is developed by [Infinite Red](https://infinite.red), [@rmevans9](https://github.com/rmevans9), and 70+ amazing contributors! Special thanks to [@skellock](https://github.com/skellock) for originally creating Reactotron while at Infinite Red.

## Premium Support

[Reactotron](https://infinite.red/reactotron), as an open source project, is free to use and always will be. [Infinite Red](https://infinite.red/) offers premium React and [React Native](https://infinite.red/react-native) mobile app design/development services. Email us at [hello@infinite.red](mailto:hello@infinite.red) to get in touch for more details.
