import React, { useContext } from "react"
import LayoutContext from "../../contexts/Layout"
import StandaloneContext from "../../contexts/Standalone"

import SidebarStateless from "./Sidebar"

function SideBar() {
  const { sideBarMode, toggleSideBar } = useContext(LayoutContext)
  const { restartServer, serverStatus } = useContext(StandaloneContext)

  return (
    <SidebarStateless
      mode={sideBarMode}
      onToggleCompact={toggleSideBar}
      onRestartServer={restartServer}
      serverStatus={serverStatus}
    />
  )
}

export default SideBar
