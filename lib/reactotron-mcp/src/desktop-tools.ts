import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod/v4"

import type { ReactotronDesktopHost } from "./desktop-host"
import { MAX_RESPONSE_CHARS, safeSerialize } from "./serialization"

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: safeSerialize(data, MAX_RESPONSE_CHARS) }] }
}

function resultOrError(result: { ok: boolean; message?: string; [key: string]: unknown }) {
  return result.ok
    ? textResult(result)
    : textResult({ status: "error", message: result.message ?? "The simulator operation failed." })
}

export function registerDesktopTools(mcp: McpServer, desktopHost: ReactotronDesktopHost) {
  mcp.registerTool("list_ios_simulators", {
    description: "List locally available iOS simulators and whether Reactotron is currently streaming them.",
  }, async () => resultOrError(await desktopHost.listIOSSimulators()))

  mcp.registerTool("list_ios_simulator_creation_options", {
    description: "List the supported iOS simulator device types and current iOS runtime that Reactotron can create.",
  }, async () => resultOrError(await desktopHost.listIOSSimulatorCreationOptions()))

  mcp.registerTool("open_ios_simulator", {
    description: "Boot an existing iOS simulator and start its local Reactotron preview. Use list_ios_simulators first.",
    inputSchema: { udid: z.string().describe("Simulator UDID from list_ios_simulators.") },
  }, async ({ udid }) => resultOrError(await desktopHost.openIOSSimulator(udid)))

  mcp.registerTool("create_ios_simulator", {
    description: "Create, boot, and stream a new iOS simulator. This creates a persistent simulator on the local machine; requires explicit confirmation.",
    inputSchema: {
      deviceTypeIdentifier: z.string().describe("Device type identifier from list_ios_simulator_creation_options."),
      confirm: z.literal(true).describe("Must be true to create a persistent iOS simulator."),
    },
  }, async ({ deviceTypeIdentifier }) => resultOrError(await desktopHost.createIOSSimulator(deviceTypeIdentifier)))

  mcp.registerTool("reconnect_ios_simulator", {
    description: "Restart the local simulator preview stream when serve-sim has disconnected.",
    inputSchema: { udid: z.string().describe("Simulator UDID.") },
  }, async ({ udid }) => resultOrError(await desktopHost.reconnectIOSSimulator(udid)))

  mcp.registerTool("control_ios_simulator", {
    description: "Control a streamed iOS simulator. Use semantic agent_ui tools to operate the app itself.",
    inputSchema: {
      udid: z.string().describe("Simulator UDID."),
      command: z.enum(["home", "landscape_left", "portrait"]).describe("Simulator control command."),
    },
  }, async ({ udid, command }) => resultOrError(await desktopHost.controlIOSSimulator(udid, command)))

  mcp.registerTool("reload_ios_app", {
    description: "Request a React Native reload through the configured local Metro server.",
  }, async () => resultOrError(await desktopHost.reloadIOSSimulator()))

  mcp.registerTool("toggle_ios_simulator_appearance", {
    description: "Toggle the simulator between light and dark appearance.",
    inputSchema: { udid: z.string().describe("Simulator UDID.") },
  }, async ({ udid }) => resultOrError(await desktopHost.toggleIOSSimulatorAppearance(udid)))

  mcp.registerTool("ios_simulator_screenshot", {
    description: "Capture the current simulator screen for visual verification. Returns an inline PNG image and local artifact path.",
    inputSchema: { udid: z.string().describe("Simulator UDID.") },
  }, async ({ udid }) => {
    const result = await desktopHost.captureIOSSimulatorScreenshot(udid)
    if (!result.ok || !result.imageBase64) return resultOrError(result)

    return {
      content: [
        { type: "image" as const, data: result.imageBase64, mimeType: result.mimeType ?? "image/png" },
        { type: "text" as const, text: safeSerialize({ status: "success", filePath: result.filePath }, MAX_RESPONSE_CHARS) },
      ],
    }
  })

  mcp.registerTool("shutdown_ios_simulator", {
    description: "Stop Reactotron streaming and shut down an iOS simulator. The simulator is retained for later use; requires explicit confirmation.",
    inputSchema: {
      udid: z.string().describe("Simulator UDID."),
      confirm: z.literal(true).describe("Must be true to shut down the simulator."),
    },
  }, async ({ udid }) => resultOrError(await desktopHost.shutdownIOSSimulator(udid)))
}
