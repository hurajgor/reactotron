import React, { useCallback, useMemo, useState } from "react"
import {
  themeStyles,
  themeVariants,
  type ThemeName,
  type ThemeStyle,
} from "@hurajgor/reactotron-core-ui"

export type ThemeAppearance = "system" | "dark" | "light"

const themeModeStorageKey = "reactotron.themeMode"
const themeStyleStorageKey = "reactotron.themeStyle"
const themeAppearanceStorageKey = "reactotron.themeAppearance"
const newTimelineStorageKey = "reactotron.enableNewTimeline"
const startWithCompactSidebarStorageKey = "reactotron.startWithCompactSidebar"
const themeModeChangeEvent = "reactotron-theme-mode-changed"

const legacyThemeMigrations: Record<string, { themeStyle: ThemeStyle; themeAppearance: ThemeAppearance }> = {
  tokyoNight: { themeStyle: "kanagawa", themeAppearance: "dark" },
  githubDark: { themeStyle: "one", themeAppearance: "dark" },
  rosePine: { themeStyle: "kanagawa", themeAppearance: "dark" },
  ayuMirage: { themeStyle: "everforest", themeAppearance: "dark" },
}

interface Context {
  themeMode: ThemeName
  themeStyle: ThemeStyle
  setThemeStyle: (themeStyle: ThemeStyle) => void
  themeAppearance: ThemeAppearance
  setThemeAppearance: (themeAppearance: ThemeAppearance) => void
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

function readLegacyThemePreference(): {
  themeStyle: ThemeStyle
  themeAppearance: ThemeAppearance
} | null {
  if (typeof window === "undefined") return null

  const savedThemeMode = window.localStorage.getItem(themeModeStorageKey)
  if (!savedThemeMode) return null

  const migratedTheme = legacyThemeMigrations[savedThemeMode]
  if (migratedTheme) return migratedTheme

  const match = themeStyles.find((style) => {
    const variants = themeVariants[style]
    return variants.dark === savedThemeMode || variants.light === savedThemeMode
  })
  if (!match) return null

  return {
    themeStyle: match,
    themeAppearance: themeVariants[match].dark === savedThemeMode ? "dark" : "light",
  }
}

function readThemeStyle(): ThemeStyle {
  if (typeof window === "undefined") return "solarized"

  const savedThemeStyle = window.localStorage.getItem(themeStyleStorageKey)
  if (themeStyles.includes(savedThemeStyle as ThemeStyle)) return savedThemeStyle as ThemeStyle

  return readLegacyThemePreference()?.themeStyle ?? "solarized"
}

function readThemeAppearance(): ThemeAppearance {
  if (typeof window === "undefined") return "system"

  const savedThemeAppearance = window.localStorage.getItem(themeAppearanceStorageKey)
  if (
    savedThemeAppearance === "system" ||
    savedThemeAppearance === "dark" ||
    savedThemeAppearance === "light"
  ) {
    return savedThemeAppearance
  }

  return readLegacyThemePreference()?.themeAppearance ?? "system"
}

function getSystemAppearance(): "dark" | "light" {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
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
  themeMode: "solarizedDark",
  themeStyle: "solarized",
  setThemeStyle: noop,
  themeAppearance: "system",
  setThemeAppearance: noop,
  enableNewTimeline: true,
  setEnableNewTimeline: noop,
  startWithCompactSidebar: true,
  setStartWithCompactSidebar: noop,
})

const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeStyle, setThemeStyleState] = useState<ThemeStyle>(readThemeStyle)
  const [themeAppearance, setThemeAppearanceState] = useState<ThemeAppearance>(readThemeAppearance)
  const [systemAppearance, setSystemAppearance] = useState<"dark" | "light">(getSystemAppearance)
  const [enableNewTimeline, setEnableNewTimelineState] = useState(readEnableNewTimeline)
  const [startWithCompactSidebar, setStartWithCompactSidebarState] = useState(
    readStartWithCompactSidebar
  )

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => setSystemAppearance(getSystemAppearance())

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  const resolvedAppearance = themeAppearance === "system" ? systemAppearance : themeAppearance
  const themeMode = themeVariants[themeStyle][resolvedAppearance]

  React.useEffect(() => {
    if (typeof window === "undefined") return

    window.localStorage.setItem(themeModeStorageKey, themeMode)
    window.dispatchEvent(new CustomEvent(themeModeChangeEvent, { detail: themeMode }))
  }, [themeMode])

  const setThemeStyle = useCallback((nextThemeStyle: ThemeStyle) => {
    setThemeStyleState(nextThemeStyle)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(themeStyleStorageKey, nextThemeStyle)
    }
  }, [])

  const setThemeAppearance = useCallback((nextThemeAppearance: ThemeAppearance) => {
    setThemeAppearanceState(nextThemeAppearance)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(themeAppearanceStorageKey, nextThemeAppearance)
    }
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
      themeStyle,
      setThemeStyle,
      themeAppearance,
      setThemeAppearance,
      enableNewTimeline,
      setEnableNewTimeline,
      startWithCompactSidebar,
      setStartWithCompactSidebar,
    }),
    [
      enableNewTimeline,
      setEnableNewTimeline,
      setStartWithCompactSidebar,
      setThemeAppearance,
      setThemeStyle,
      startWithCompactSidebar,
      themeAppearance,
      themeMode,
      themeStyle,
    ]
  )

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>
}

export {
  startWithCompactSidebarStorageKey,
  themeAppearanceStorageKey,
  themeModeChangeEvent,
  themeModeStorageKey,
  themeStyleStorageKey,
}
export default AppPreferencesContext
export const AppPreferencesProvider = Provider
