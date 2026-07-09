import React from "react"
import { Motion, spring } from "react-motion"
import { Link } from "react-router-dom"
import colorInterpolate from "color-interpolate"
import styled from "styled-components"

const Theme = { highlight: "hsl(290, 3.2%, 47.4%)", foregroundLight: "#c3c3c3" }

interface SideBarButtonComponentProps {
  icon?: any
  iconColor?: string
  image?: any
  path: string
  text: string
  isActive: boolean
  hideTopBar?: boolean
  iconSize?: number
  isCompact?: boolean
  onPress?: () => void
}

interface SideBarButtonProps {
  $hideTopBar: boolean
  $colorAnimation: number
  $isCompact?: boolean
}

const colorInterpolator = colorInterpolate([Theme.highlight, Theme.foregroundLight])

export const SideBarButtonContainer = styled.div.attrs(() => ({}))<SideBarButtonProps>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: ${(props) => (props.$isCompact ? 54 : 69)}px;
  padding: ${(props) => (props.$isCompact ? "7px 0" : "15px 0")};
  margin: 0 ${(props) => (props.$isCompact ? 6 : 10)}px;
  cursor: pointer;
  border-top: ${(props) => (props.$hideTopBar ? "none" : `1px solid ${props.theme.line}`)};
  color: ${(props) => colorInterpolator(props.$colorAnimation)};
`

const Image = styled.img.attrs(() => ({}))<SideBarButtonProps>`
  width: 32px;
  height: 32px;
  padding-bottom: 4px;
  filter: grayscale(${(props) => 100 - 100 * props.$colorAnimation}%)
    brightness(${(props) => 70 + 30 * props.$colorAnimation}%);
`

const Title = styled.div`
  padding-top: 2px;
  text-align: center;
  font-size: 12px;
`

function SideBarButton({
  icon: Icon,
  iconColor,
  image,
  path,
  text,
  isActive,
  hideTopBar,
  iconSize,
  isCompact,
  onPress,
}: SideBarButtonComponentProps) {
  const resolvedIconSize = iconSize || (isCompact ? 27 : 32)

  return (
    <Motion style={{ color: spring(isActive ? 1 : 0) }}>
      {({ color }) => (
        <Link to={path} title={text} style={{ textDecoration: "none" }} onClick={onPress}>
          <SideBarButtonContainer
            $hideTopBar={hideTopBar || false}
            $colorAnimation={color}
            $isCompact={isCompact}
          >
            {Icon && <Icon size={resolvedIconSize} color={iconColor} />}
            {image && (
              <Image src={image} $hideTopBar={hideTopBar || false} $colorAnimation={color} />
            )}
            {!isCompact && <Title>{text}</Title>}
          </SideBarButtonContainer>
        </Link>
      )}
    </Motion>
  )
}

export default SideBarButton
