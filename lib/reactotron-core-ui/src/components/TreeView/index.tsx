import React from "react"
import { JSONTree } from "react-json-tree"
import styled from "styled-components"

import useColorScheme from "../../hooks/useColorScheme"
import { ReactotronTheme, themes } from "../../themes"

// TODO: Ripping this right from reactotron right now... should probably be better.
const theme = {
  author: "david hart (http://hart-dev.com)",
  base0A: "#e0af68",
  base0B: "#9ece6a",
  base0C: "#73daca",
  base0D: "#7aa2f7",
  base0E: "#bb9af7",
  base0F: "#ff9e64",
  base00: "#1a1b26",
  base01: "#24283b",
  base02: "#414868",
  base03: "#565f89",
  base04: "#787c99",
  base05: "#a9b1d6",
  base06: "#c0caf5",
  base07: "#ffffff",
  base08: "#f7768e",
  base09: "#7dcfff",
  scheme: "twilight",
}

const MutedContainer = styled.span`
  color: ${(props) => props.theme.highlight};
  display: inline-flex;
`

const ButtonCopy = styled.button`
  margin-left: 6px;
  padding: 0 6px;
  font-size: 10px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  color: ${(props) => props.theme.background};
  background-color: ${(props) => props.theme.highlight};

  &:hover {
    opacity: 0.85;
  }
`

const getTreeTheme = (baseTheme: ReactotronTheme) => ({
  tree: { backgroundColor: "transparent", marginTop: -3 },
  ...theme,
  base0B: baseTheme.foreground,
})

interface Props {
  // value: object
  value: any
  level?: number
  copyToClipboard?: (text: string) => void
}

export default function TreeView({ value, level = 1, copyToClipboard }: Props) {
  const colorScheme = useColorScheme()

  return (
    <JSONTree
      data={value}
      hideRoot
      shouldExpandNodeInitially={(keyName, data, minLevel) => minLevel <= level}
      theme={getTreeTheme(themes[colorScheme])}
      getItemString={(type, data, itemType, itemString) => {
        if (type === "Object") {
          const handleCopy = copyToClipboard
            ? (event: React.MouseEvent) => {
                event.stopPropagation()
                copyToClipboard(JSON.stringify(data, null, 2))
              }
            : undefined
          return (
            <MutedContainer>
              {itemType}
              {handleCopy && <ButtonCopy onClick={handleCopy}>Copy</ButtonCopy>}
            </MutedContainer>
          )
        }

        return (
          <MutedContainer>
            {itemType} {itemString}
          </MutedContainer>
        )
      }}
      valueRenderer={(transformed, untransformed) => {
        return <span>{`${untransformed || transformed}`}</span>
      }}
    />
  )
}
