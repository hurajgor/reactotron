import React, { useCallback, useMemo, useState } from "react"

export type ThemeMode = "tokyoNight" | "t3Code"

const themeModeStorageKey = "reactotron.themeMode"
const newTimelineStorageKey = "reactotron.enableNewTimeline"
const themeModeChangeEvent = "reactotron-theme-mode-changed"

interface Context {
  themeMode: ThemeMode
  setThemeMode: (themeMode: ThemeMode) => void
  enableNewTimeline: boolean
  setEnableNewTimeline: (isEnabled: boolean) => void
}

const noop = (): void => {
  throw Error(
    "Noop function called. This is a bug. Please report it to the Reactotron team. Thanks! :)"
  )
}

function readThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "tokyoNight"

  const savedThemeMode = window.localStorage.getItem(themeModeStorageKey)
  if (savedThemeMode === "tokyoNight" || savedThemeMode === "t3Code") return savedThemeMode

  return "tokyoNight"
}

function readEnableNewTimeline(): boolean {
  if (typeof window === "undefined") return true

  const savedNewTimelinePreference = window.localStorage.getItem(newTimelineStorageKey)
  if (savedNewTimelinePreference === null) return true

  return savedNewTimelinePreference === "true"
}

const AppPreferencesContext = React.createContext<Context>({
  themeMode: "tokyoNight",
  setThemeMode: noop,
  enableNewTimeline: true,
  setEnableNewTimeline: noop,
})

const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readThemeMode)
  const [enableNewTimeline, setEnableNewTimelineState] = useState(readEnableNewTimeline)

  const setThemeMode = useCallback((nextThemeMode: ThemeMode) => {
    setThemeModeState(nextThemeMode)
    if (typeof window === "undefined") return

    window.localStorage.setItem(themeModeStorageKey, nextThemeMode)
    window.dispatchEvent(new CustomEvent(themeModeChangeEvent, { detail: nextThemeMode }))
  }, [])

  const setEnableNewTimeline = useCallback((isEnabled: boolean) => {
    setEnableNewTimelineState(isEnabled)
    if (typeof window === "undefined") return

    window.localStorage.setItem(newTimelineStorageKey, isEnabled ? "true" : "false")
  }, [])

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      enableNewTimeline,
      setEnableNewTimeline,
    }),
    [enableNewTimeline, setEnableNewTimeline, setThemeMode, themeMode]
  )

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>
}

export { themeModeChangeEvent, themeModeStorageKey }
export default AppPreferencesContext
export const AppPreferencesProvider = Provider
