import React from "react"

import useLayout from "./useLayout"
import type { SideBarMode } from "./useLayout"

interface Context {
  isSideBarOpen: boolean
  sideBarMode: SideBarMode
  toggleSideBar: () => void
}

const noop = (): void => {
  throw Error(
    "Noop function called. This is a bug. Please report it to the Reactotron team. Thanks! :)"
  )
}

const LayoutContext = React.createContext<Context>({
  isSideBarOpen: true,
  sideBarMode: "expanded",
  toggleSideBar: noop,
})

const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSideBarOpen, sideBarMode, toggleSideBar } = useLayout()

  return (
    <LayoutContext.Provider
      value={{
        isSideBarOpen,
        sideBarMode,
        toggleSideBar,
      }}
    >
      {children}
    </LayoutContext.Provider>
  )
}

export default LayoutContext
export const LayoutProvider = Provider
