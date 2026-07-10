import React, { useContext, useState } from "react"
import { ipcRenderer } from "electron"

import StandaloneContext from "../../contexts/Standalone"

import Footer from "./Stateless"

type ReloadResponse = {
  ok: boolean
  message: string
}

export default function ConnectedFooter() {
  const {
    serverStatus, connections, selectedConnection, selectConnection,
    mcpStatus, mcpPort, toggleMcp, mcpRedactionEnforced, openMcpSettings,
  } = useContext(StandaloneContext)
  const [isOpen, setIsOpen] = useState(false)

  const reloadMetro = async () => {
    const result = await ipcRenderer.invoke("reload-ios-simulator") as ReloadResponse
    console.log(
      `[Reactotron Desktop] Metro reload ${result.ok ? "succeeded" : "failed"}: ${
        result.message
      }`
    )
  }

  return (
    <Footer
      serverStatus={serverStatus}
      connections={connections}
      selectedConnection={selectedConnection}
      onChangeConnection={selectConnection}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      mcpStatus={mcpStatus}
      mcpPort={mcpPort}
      onToggleMcp={toggleMcp}
      mcpRedactionEnforced={mcpRedactionEnforced}
      onOpenMcpSettings={openMcpSettings}
      onReloadMetro={reloadMetro}
    />
  )
}
