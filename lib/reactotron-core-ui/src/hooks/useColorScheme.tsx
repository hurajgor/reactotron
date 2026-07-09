import React from "react"
import type { ThemeName } from "../themes"

const themeModeStorageKey = "reactotron.themeMode"
const themeModeChangeEvent = "reactotron-theme-mode-changed"

function getStoredThemeName(): ThemeName {
  if (typeof window === "undefined") return "tokyoNight"

  const savedThemeMode = window.localStorage.getItem(themeModeStorageKey)
  if (savedThemeMode === "tokyoNight" || savedThemeMode === "t3Code") return savedThemeMode

  return "tokyoNight"
}

function useColorScheme(): ThemeName {
  const [themeName, setThemeName] = React.useState<ThemeName>(getStoredThemeName)

  React.useEffect(() => {
    const handleThemeModeChange = () => {
      setThemeName(getStoredThemeName())
    }

    window.addEventListener(themeModeChangeEvent, handleThemeModeChange)
    return () => {
      window.removeEventListener(themeModeChangeEvent, handleThemeModeChange)
    }
  }, [])

  return themeName
}

export default useColorScheme
