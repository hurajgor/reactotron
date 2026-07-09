import React from "react"
import { AppPreferencesProvider } from "./AppPreferences"
import { LayoutProvider } from "./Layout"
import { StandaloneProvider } from "./Standalone"

const RootContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AppPreferencesProvider>
      <LayoutProvider>
        <StandaloneProvider>{children}</StandaloneProvider>
      </LayoutProvider>
    </AppPreferencesProvider>
  )
}

export default RootContextProvider
