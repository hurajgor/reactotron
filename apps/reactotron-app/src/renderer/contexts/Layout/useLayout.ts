import { useCallback, useReducer } from "react"
import { produce } from "immer"

export enum ActionTypes {
  ToggleSideBar = "TOGGLE_SIDEBAR",
}

export type SideBarMode = "expanded" | "compact"

interface State {
  isSideBarOpen: boolean
  sideBarMode: SideBarMode
}

type Action = { type: ActionTypes.ToggleSideBar }

export function reducer(state: State, action: Action) {
  switch (action.type) {
    case ActionTypes.ToggleSideBar:
      return produce(state, (draftState) => {
        draftState.sideBarMode = draftState.sideBarMode === "compact" ? "expanded" : "compact"
        draftState.isSideBarOpen = true
      })
    default:
      return state
  }
}

function useLayout() {
  const [state, dispatch] = useReducer(reducer, {
    isSideBarOpen: true,
    sideBarMode: "expanded",
  })

  const toggleSideBar = useCallback(() => {
    dispatch({ type: ActionTypes.ToggleSideBar })
  }, [])

  return {
    ...state,
    toggleSideBar,
  }
}

export default useLayout
