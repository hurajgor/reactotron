import type { ImagePayload } from "@hurajgor/reactotron-core-contract"
import type { ReactotronCore, Plugin } from "../@hurajgor/reactotron-core-client"

/**
 * Provides an image.
 */
const image = () => (reactotron: ReactotronCore) => {
  return {
    features: {
      // expanded just to show the specs
      image: (payload: ImagePayload) => {
        const { uri, preview, filename, width, height, caption } = payload
        return reactotron.send("image", { uri, preview, filename, width, height, caption })
      },
    },
  } satisfies Plugin<ReactotronCore>
}

export default image
