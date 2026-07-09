interface ReactotronTheme {
  fontFamily: string
  background: string
  backgroundDarker: string
  backgroundHighlight: string
  backgroundLight: string
  backgroundLighter: string
  backgroundSubtleDark: string
  backgroundSubtleLight: string
  bold: string
  chrome: string
  chromeLine: string
  constant: string
  foreground: string
  foregroundDark: string
  foregroundLight: string
  glow: string
  heading: string
  highlight: string
  keyword: string
  line: string
  modalOverlay: string
  string: string
  subtleLine: string
  support: string
  tag: string
  tagComplement: string
  warning: string
}

const colorSchemes = ["dark", "light"] as const

type ColorScheme = (typeof colorSchemes)[number]

const themes: Record<ColorScheme, ReactotronTheme> = {
  dark: {
    fontFamily:
      '"JetBrains Mono", "SF Mono", "Fira Code", "Consolas", "Segoe UI", "Roboto", "-apple-system", "Helvetica Neue", sans-serif',
    background: "#1a1b26",
    backgroundDarker: "#16161e",
    backgroundHighlight: "#283457",
    backgroundLight: "#ffffff",
    backgroundLighter: "#24283b",
    backgroundSubtleDark: "#16161e",
    backgroundSubtleLight: "#1f2335",
    bold: "#c0caf5",
    chrome: "#1f2335",
    chromeLine: "#292e42",
    constant: "#7dcfff",
    foreground: "#a9b1d6",
    foregroundDark: "#787c99",
    foregroundLight: "#c0caf5",
    glow: "rgba(15, 15, 25, 0.72)",
    heading: "#7aa2f7",
    highlight: "#7aa2f7",
    keyword: "#bb9af7",
    line: "#24283b",
    modalOverlay: "rgba(22, 22, 30, 0.96)",
    string: "#7dcfff",
    subtleLine: "#1b1e2d",
    support: "#7dcfff",
    tag: "#bb9af7",
    tagComplement: "#1a1b26",
    warning: "#bb9af7",
  },
  light: {
    fontFamily:
      '"Fira Code", "SF Mono", "Consolas", "Segoe UI", "Roboto", "-apple-system", "Helvetica Neue", sans-serif',
    background: "#ffffff",
    backgroundDarker: "hsl(0, 0%, 90%)",
    backgroundHighlight: "#f0f0f0",
    backgroundLight: "#f9f9f9",
    backgroundLighter: "#e6e6e6",
    backgroundSubtleDark: "hsl(0, 0%, 95%)",
    backgroundSubtleLight: "hsl(0, 0%, 97%)",
    bold: "#222222",
    chrome: "hsl(0, 0%, 90%)",
    chromeLine: "hsl(0, 0%, 85%)",
    constant: "#d17d00",
    foreground: "#333333",
    foregroundDark: "#555555",
    foregroundLight: "#666666",
    glow: "hsla(0, 0%, 90%, 0.8)",
    heading: "#4b5f85",
    highlight: "hsl(210, 10%, 70%)",
    keyword: "#9b0000",
    line: "hsl(204, 4.8%, 95%)",
    modalOverlay: "hsla(0, 0%, 100%, 0.95)",
    string: "#718c00",
    subtleLine: "hsl(204, 4.8%, 90%)",
    support: "#597ab8",
    tag: "#d9484f",
    tagComplement: "hsl(13.7, 57.7%, 45%)",
    warning: "#b35900",
  },
}

export { themes }
export type { ColorScheme, ReactotronTheme }
