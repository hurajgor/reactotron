import type { ApiResponsePayload } from "@hurajgor/reactotron-core-contract"
import type { ReactotronCore, Plugin } from "../@hurajgor/reactotron-core-client"

/**
 * Sends API request/response information.
 */
const apiResponse = () => (reactotron: ReactotronCore) => {
  return {
    features: {
      apiResponse: (
        request: ApiResponsePayload["request"],
        response: ApiResponsePayload["response"],
        duration: number
      ) => {
        const ok =
          response &&
          response.status &&
          typeof response.status === "number" &&
          response.status >= 200 &&
          response.status <= 299
        const important = !ok
        reactotron.send("api.response", { request, response, duration }, important)
      },
    },
  } satisfies Plugin<ReactotronCore>
}

export default apiResponse
