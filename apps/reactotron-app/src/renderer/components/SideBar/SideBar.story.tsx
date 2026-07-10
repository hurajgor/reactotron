import React from "react"
import { BrowserRouter as Router } from "react-router-dom"

import SideBar from "./Sidebar"

export default {
  title: "SideBar",
}

export const Default = () => (
  <Router>
    <SideBar
      mode="expanded"
      onRestartServer={() => {}}
      onToggleCompact={() => {}}
      serverStatus="started"
    />
  </Router>
)
