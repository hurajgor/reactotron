import React from "react"
import { ColorScheme } from "../themes"

const themeModeStorageKey = "reactotron.themeMode"
const themeModeChangeEvent = "reactotron-theme-mode-changed"

function getColorScheme({ matches }: MediaQueryList | MediaQueryListEvent): ColorScheme {
  return matches ? "dark" : "light"
}

function getStoredColorScheme(fallback: ColorScheme): ColorScheme {
  if (typeof window === "undefined") return fallback

  const savedThemeMode = window.localStorage.getItem(themeModeStorageKey)
  if (savedThemeMode === "dark" || savedThemeMode === "light") return savedThemeMode

  return fallback
}

function useColorScheme(): ColorScheme {
  const mediaQueryRef = React.useRef<MediaQueryList | null>(
    window?.matchMedia?.("(prefers-color-scheme: dark)") || null
  )

  const [colorScheme, setColorScheme] = React.useState<ColorScheme>(() => {
    if (typeof window === "undefined" || !mediaQueryRef.current) return "dark"
    return getStoredColorScheme(getColorScheme(mediaQueryRef.current))
  })

  React.useEffect(() => {
    const mediaQuery = mediaQueryRef.current

    if (!mediaQuery) return () => {}

    const handleChange = (e: MediaQueryListEvent) => {
      setColorScheme(getStoredColorScheme(getColorScheme(e)))
    }

    const handleThemeModeChange = () => {
      setColorScheme(getStoredColorScheme(getColorScheme(mediaQuery)))
    }

    mediaQuery.addEventListener("change", handleChange)
    window.addEventListener(themeModeChangeEvent, handleThemeModeChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
      window.removeEventListener(themeModeChangeEvent, handleThemeModeChange)
    }
  }, [])

  return colorScheme
}

export default useColorScheme
