import type { Reactotron } from "@hurajgor/reactotron-core-client"
import { mst, type MstPluginOptions } from "../../src/@hurajgor/reactotron-mst"
import { createMockReactotron } from "../mocks/create-mock-reactotron"

/**
 * Creates an @hurajgor/reactotron-mst plugin with a mocked reactotron.
 */
export function createMstPlugin(pluginOptions: MstPluginOptions = {}) {
  const reactotron = createMockReactotron()
  const plugin = mst(pluginOptions)(reactotron as unknown as Reactotron)
  const track = plugin.features.trackMstNode

  return { reactotron, plugin, track }
}
