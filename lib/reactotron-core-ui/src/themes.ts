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

const themeNames = ["tokyoNight", "t3Code"] as const

type ThemeName = (typeof themeNames)[number]

const themes: Record<ThemeName, ReactotronTheme> = {
  tokyoNight: {
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
  t3Code: {
    fontFamily:
      '"DM Sans Variable", "DM Sans", "-apple-system", "BlinkMacSystemFont", "Segoe UI", system-ui, sans-serif',
    background: "#161616",
    backgroundDarker: "#0f0f0f",
    backgroundHighlight: "#1f2d53",
    backgroundLight: "#ffffff",
    backgroundLighter: "#1b1b1b",
    backgroundSubtleDark: "#101010",
    backgroundSubtleLight: "#202020",
    bold: "#f5f5f5",
    chrome: "#1b1b1b",
    chromeLine: "rgba(255, 255, 255, 0.06)",
    constant: "#60a5fa",
    foreground: "#d4d4d4",
    foregroundDark: "#8c8c8c",
    foregroundLight: "#f5f5f5",
    glow: "rgba(0, 0, 0, 0.6)",
    heading: "#f5f5f5",
    highlight: "#366ffb",
    keyword: "#a78bfa",
    line: "rgba(255, 255, 255, 0.06)",
    modalOverlay: "rgba(15, 15, 15, 0.96)",
    string: "#34d399",
    subtleLine: "rgba(255, 255, 255, 0.04)",
    support: "#93c5fd",
    tag: "#c084fc",
    tagComplement: "#161616",
    warning: "#f59e0b",
  },
}

export { themes }
export type { ReactotronTheme, ThemeName }
