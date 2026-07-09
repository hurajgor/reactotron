import React, { useContext } from "react"
import { Header } from "reactotron-core-ui"
import styled from "styled-components"

import AppPreferencesContext, { ThemeMode } from "../../contexts/AppPreferences"

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
`

const SettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 26px 28px 28px;
  overflow-y: auto;
  overflow-x: hidden;
`

const SettingsContent = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
`

const Section = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 360px);
  gap: 24px;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
  min-height: 94px;
  padding: 18px 0;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
    gap: 12px;
    align-items: start;
  }
`

const SectionTitle = styled.h2`
  color: ${(props) => props.theme.foregroundLight};
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 8px;
`

const SectionDescription = styled.p`
  color: ${(props) => props.theme.foregroundDark};
  font-size: 13px;
  line-height: 20px;
  margin: 0 0 14px;
`

const ThemeSelector = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(82px, 1fr));
  gap: 6px;
  width: 100%;
  min-width: 0;
`

const ThemeOption = styled.button<{ $isActive: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  border: 1px solid ${(props) => (props.$isActive ? props.theme.highlight : props.theme.chromeLine)};
  border-radius: 7px;
  background-color: ${(props) =>
    props.$isActive ? "rgba(122, 162, 247, 0.18)" : props.theme.background};
  color: ${(props) => (props.$isActive ? props.theme.highlight : props.theme.foreground)};
  cursor: pointer;
  font-size: 12px;

  &:hover {
    border-color: ${(props) => props.theme.highlight};
  }
`

const PreferenceRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 18px;
  color: ${(props) => props.theme.foreground};
  cursor: pointer;

  @media (max-width: 760px) {
    justify-content: flex-start;
  }
`

const ToggleInput = styled.input`
  position: absolute;
  opacity: 0;
  pointer-events: none;
`

const ToggleTrack = styled.span<{ $isEnabled: boolean }>`
  display: inline-flex;
  align-items: center;
  width: 44px;
  height: 24px;
  flex: 0 0 44px;
  padding: 2px;
  border: 1px solid
    ${(props) => (props.$isEnabled ? props.theme.highlight : props.theme.chromeLine)};
  border-radius: 999px;
  background-color: ${(props) =>
    props.$isEnabled ? "rgba(122, 162, 247, 0.24)" : props.theme.background};
  transition:
    background-color 0.12s ease-out,
    border-color 0.12s ease-out;
`

const ToggleThumb = styled.span<{ $isEnabled: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background-color: ${(props) =>
    props.$isEnabled ? props.theme.highlight : props.theme.foregroundDark};
  transform: translateX(${(props) => (props.$isEnabled ? 20 : 0)}px);
  transition:
    background-color 0.12s ease-out,
    transform 0.12s ease-out;
`

const themeOptions: Array<{ label: string; value: ThemeMode }> = [
  { label: "System", value: "system" },
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
]

function Settings() {
  const { themeMode, setThemeMode, enableNewTimeline, setEnableNewTimeline } =
    useContext(AppPreferencesContext)

  return (
    <Container>
      <Header title="Settings" isDraggable />
      <SettingsContainer>
        <SettingsContent>
          <Section>
            <div>
              <SectionTitle>Theme</SectionTitle>
              <SectionDescription>Choose how Reactotron picks its color theme.</SectionDescription>
            </div>
            <ThemeSelector>
              {themeOptions.map((option) => (
                <ThemeOption
                  key={option.value}
                  type="button"
                  $isActive={themeMode === option.value}
                  onClick={() => setThemeMode(option.value)}
                >
                  {option.label}
                </ThemeOption>
              ))}
            </ThemeSelector>
          </Section>

          <Section>
            <div>
              <SectionTitle>Timeline</SectionTitle>
              <SectionDescription>
                Use the newer event table UI when opening Timeline.
              </SectionDescription>
            </div>
            <PreferenceRow>
              <ToggleInput
                type="checkbox"
                checked={enableNewTimeline}
                onChange={(event) => setEnableNewTimeline(event.target.checked)}
              />
              <ToggleTrack $isEnabled={enableNewTimeline}>
                <ToggleThumb $isEnabled={enableNewTimeline} />
              </ToggleTrack>
            </PreferenceRow>
          </Section>
        </SettingsContent>
      </SettingsContainer>
    </Container>
  )
}

export default Settings
