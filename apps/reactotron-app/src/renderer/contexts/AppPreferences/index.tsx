import React, { useCallback, useMemo, useState } from "react"

const themeModes = [
  "tokyoNight",
  "t3Code",
  "catppuccinMocha",
  "githubDark",
  "oneDarkPro",
  "nord",
  "rosePine",
  "gruvboxDark",
  "ayuMirage",
] as const

export type ThemeMode = (typeof themeModes)[number]

const themeModeStorageKey = "reactotron.themeMode"
const newTimelineStorageKey = "reactotron.enableNewTimeline"
const startWithCompactSidebarStorageKey = "reactotron.startWithCompactSidebar"
const themeModeChangeEvent = "reactotron-theme-mode-changed"

interface Context {
  themeMode: ThemeMode
  setThemeMode: (themeMode: ThemeMode) => void
  enableNewTimeline: boolean
  setEnableNewTimeline: (isEnabled: boolean) => void
  startWithCompactSidebar: boolean
  setStartWithCompactSidebar: (isEnabled: boolean) => void
}

const noop = (): void => {
  throw Error(
    "Noop function called. This is a bug. Please report it to the Reactotron team. Thanks! :)"
  )
}

function readThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "tokyoNight"

  const savedThemeMode = window.localStorage.getItem(themeModeStorageKey)
  if (themeModes.includes(savedThemeMode as ThemeMode)) return savedThemeMode as ThemeMode

  return "tokyoNight"
}

function readEnableNewTimeline(): boolean {
  if (typeof window === "undefined") return true

  const savedNewTimelinePreference = window.localStorage.getItem(newTimelineStorageKey)
  if (savedNewTimelinePreference === null) return true

  return savedNewTimelinePreference === "true"
}

function readStartWithCompactSidebar(): boolean {
  if (typeof window === "undefined") return true

  const savedStartWithCompactSidebar = window.localStorage.getItem(
    startWithCompactSidebarStorageKey
  )
  if (savedStartWithCompactSidebar === null) return true

  return savedStartWithCompactSidebar === "true"
}

const AppPreferencesContext = React.createContext<Context>({
  themeMode: "tokyoNight",
  setThemeMode: noop,
  enableNewTimeline: true,
  setEnableNewTimeline: noop,
  startWithCompactSidebar: true,
  setStartWithCompactSidebar: noop,
})

const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readThemeMode)
  const [enableNewTimeline, setEnableNewTimelineState] = useState(readEnableNewTimeline)
  const [startWithCompactSidebar, setStartWithCompactSidebarState] = useState(
    readStartWithCompactSidebar
  )

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

  const setStartWithCompactSidebar = useCallback((isEnabled: boolean) => {
    setStartWithCompactSidebarState(isEnabled)
    if (typeof window === "undefined") return

    window.localStorage.setItem(startWithCompactSidebarStorageKey, isEnabled ? "true" : "false")
  }, [])

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      enableNewTimeline,
      setEnableNewTimeline,
      startWithCompactSidebar,
      setStartWithCompactSidebar,
    }),
    [
      enableNewTimeline,
      setEnableNewTimeline,
      setStartWithCompactSidebar,
      setThemeMode,
      startWithCompactSidebar,
      themeMode,
    ]
  )

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>
}

export { startWithCompactSidebarStorageKey, themeModeChangeEvent, themeModeStorageKey }
export default AppPreferencesContext
export const AppPreferencesProvider = Provider
