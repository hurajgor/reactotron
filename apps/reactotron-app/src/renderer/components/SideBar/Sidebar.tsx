import React from "react"
import {
  MdReorder,
  MdAssignment,
  MdPhoneIphone,
  MdLiveHelp,
  MdWarning,
  MdOutlineMobileFriendly,
  MdMobiledataOff,
  MdNetworkCheck,
  MdSmartToy,
  MdChevronLeft,
  MdChevronRight,
} from "react-icons/md"
import { FaMagic } from "react-icons/fa"
import styled from "styled-components"

import SideBarButton from "../SideBarButton"
import { reactotronLogo } from "../../images"
import { ServerStatus } from "../../contexts/Standalone/useStandalone"
import { getConfiguredServerPort } from "../../config"
import type { SideBarMode } from "../../contexts/Layout/useLayout"

interface SideBarContainerProps {
  $mode: SideBarMode
}
const SideBarContainer = styled.div.attrs(() => ({}))<SideBarContainerProps>`
  display: flex;
  flex-direction: column;
  padding-top: ${(props) => (props.$mode === "compact" ? 14 : 25)}px;
  background-color: ${(props) => props.theme.backgroundSubtleDark};
  border-right: 1px solid ${(props) => props.theme.chromeLine};
  width: ${(props) => (props.$mode === "compact" ? 58 : 115)}px;
  flex: 0 0 ${(props) => (props.$mode === "compact" ? 58 : 115)}px;
  transition:
    flex-basis 0.16s ease-out,
    width 0.16s ease-out;
  overflow: hidden;
`

const Spacer = styled.div`
  flex: 1;
`

const SideBarTools = styled.div<{ $isCompact: boolean }>`
  display: flex;
  flex-direction: ${(props) => (props.$isCompact ? "column" : "row")};
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 0 10px;
`

const SideBarToolButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid ${(props) => props.theme.line};
  border-radius: 4px;
  background: transparent;
  color: ${(props) => props.theme.foregroundDark};
  cursor: pointer;

  &:hover {
    color: ${(props) => props.theme.foreground};
    background-color: ${(props) => props.theme.backgroundHighlight};
  }
`

function SideBar({
  mode,
  onToggleCompact,
  serverStatus,
}: {
  mode: SideBarMode
  onToggleCompact: () => void
  serverStatus: ServerStatus
}) {
  const isCompact = mode === "compact"
  let serverIcon = MdMobiledataOff
  let iconColor
  let serverText = "Stopped"
  if (serverStatus === "started") {
    serverIcon = MdOutlineMobileFriendly
    serverText = "Running"
  }
  if (serverStatus === "portUnavailable") {
    serverIcon = MdWarning
    iconColor = "yellow"
    serverText = `Port ${getConfiguredServerPort()} unavailable`
  }

  const retryConnection = () => {
    if (serverStatus === "portUnavailable") {
      // TODO: Reconnect more elegantly than forcing a reload
      window.location.reload()
    }
  }

  return (
    <SideBarContainer $mode={mode}>
      <SideBarTools $isCompact={isCompact}>
        <SideBarToolButton
          type="button"
          title={isCompact ? "Expand sidebar" : "Compact sidebar"}
          onClick={onToggleCompact}
        >
          {isCompact ? <MdChevronRight size={20} /> : <MdChevronLeft size={20} />}
        </SideBarToolButton>
      </SideBarTools>

      <SideBarButton image={reactotronLogo} path="/" text="Home" hideTopBar isCompact={isCompact} />
      <SideBarButton icon={MdReorder} path="/timeline" text="Timeline" isCompact={isCompact} />
      <SideBarButton icon={MdNetworkCheck} path="/network" text="Network" isCompact={isCompact} />
      <SideBarButton icon={MdSmartToy} path="/agent" text="Agent" isCompact={isCompact} />
      <SideBarButton
        icon={MdAssignment}
        path="/state/subscriptions"
        matchPath="/state"
        text="State"
        isCompact={isCompact}
      />
      <SideBarButton
        icon={MdPhoneIphone}
        path="/native/overlay"
        matchPath="/native"
        text="React Native"
        isCompact={isCompact}
      />
      <SideBarButton
        icon={FaMagic}
        path="/customCommands"
        text="Custom Commands"
        iconSize={isCompact ? 23 : 25}
        isCompact={isCompact}
      />

      <Spacer />

      <SideBarButton
        icon={serverIcon}
        path="#"
        onPress={retryConnection}
        text={serverText}
        iconColor={iconColor}
        isCompact={isCompact}
      />

      <SideBarButton icon={MdLiveHelp} path="/help" text="Help" hideTopBar isCompact={isCompact} />
    </SideBarContainer>
  )
}

export default SideBar
