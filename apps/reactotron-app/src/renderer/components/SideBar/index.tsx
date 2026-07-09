import React, { useContext } from "react"
import LayoutContext from "../../contexts/Layout"
import StandaloneContext from "../../contexts/Standalone"

import SidebarStateless from "./Sidebar"

function SideBar() {
  const { sideBarMode, toggleSideBar } = useContext(LayoutContext)
  const { serverStatus } = useContext(StandaloneContext)

  return (
    <SidebarStateless
      mode={sideBarMode}
      onToggleCompact={toggleSideBar}
      serverStatus={serverStatus}
    />
  )
}

export default SideBar
