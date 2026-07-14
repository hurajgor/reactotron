import "v8-compile-cache"
import React, { useContext } from "react"
import { createRoot } from "react-dom/client"
import { ReactotronAppProvider } from "reactotron-core-ui"

import "./global.css"

import App from "./App"
import AppPreferencesContext, { AppPreferencesProvider } from "./contexts/AppPreferences"

function ThemedApp() {
  const { themeMode } = useContext(AppPreferencesContext)

  return (
    <ReactotronAppProvider themeName={themeMode}>
      <App />
    </ReactotronAppProvider>
  )
}

const root = createRoot(document.getElementById("app"))
root.render(
  <AppPreferencesProvider>
    <ThemedApp />
  </AppPreferencesProvider>
)

// accept it like it's hot
if ((module as any).hot) {
  ;(module as any).hot.accept()
  ;(module as any).hot.dispose(() => {
    root.unmount()
  })
}
