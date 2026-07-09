import React from "react"
import styled, { ThemeProvider } from "styled-components"

import useColorScheme from "../../hooks/useColorScheme"
import { ThemeName, themes } from "../../themes"

const ReactotronContainer = styled.div`
  font-family: ${(props) => props.theme.fontFamily};
  font-size: 0.94em;
  width: 100%;
  height: 100%;
  user-select: none;
`

interface Props {
  children: React.ReactNode
  themeName?: ThemeName
}

const ReactotronAppProvider: React.FC<Props> = ({ children, themeName }) => {
  const storedThemeName = useColorScheme()
  const resolvedThemeName = themeName || storedThemeName

  return (
    <ThemeProvider theme={themes[resolvedThemeName]}>
      <ReactotronContainer>{children}</ReactotronContainer>
    </ThemeProvider>
  )
}

export default ReactotronAppProvider
