import { useCallback, useReducer } from "react"
import { produce } from "immer"

import { startWithCompactSidebarStorageKey } from "../AppPreferences"

export enum ActionTypes {
  ToggleSideBar = "TOGGLE_SIDEBAR",
}

export type SideBarMode = "expanded" | "compact"

interface State {
  isSideBarOpen: boolean
  sideBarMode: SideBarMode
}

type Action = { type: ActionTypes.ToggleSideBar }

function getInitialSideBarMode(): SideBarMode {
  if (typeof window === "undefined") return "compact"

  const savedStartWithCompactSidebar = window.localStorage.getItem(
    startWithCompactSidebarStorageKey
  )
  if (savedStartWithCompactSidebar === null) return "compact"

  return savedStartWithCompactSidebar === "true" ? "compact" : "expanded"
}

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
  const initialSideBarMode = getInitialSideBarMode()
  const [state, dispatch] = useReducer(reducer, {
    isSideBarOpen: true,
    sideBarMode: initialSideBarMode,
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
