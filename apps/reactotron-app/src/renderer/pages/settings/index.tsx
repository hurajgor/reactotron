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

const SelectWrap = styled.div`
  position: relative;
  width: 100%;
  min-width: 0;

  &::after {
    content: "";
    position: absolute;
    right: 14px;
    top: 50%;
    width: 7px;
    height: 7px;
    border-right: 1px solid ${(props) => props.theme.foregroundDark};
    border-bottom: 1px solid ${(props) => props.theme.foregroundDark};
    pointer-events: none;
    transform: translateY(-65%) rotate(45deg);
  }
`

const ThemeSelect = styled.select`
  width: 100%;
  height: 34px;
  padding: 0 36px 0 12px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 7px;
  appearance: none;
  background-color: ${(props) => props.theme.background};
  color: ${(props) => props.theme.foreground};
  cursor: pointer;
  font-size: 12px;
  outline: none;

  &:hover {
    border-color: ${(props) => props.theme.highlight};
  }

  &:focus {
    border-color: ${(props) => props.theme.highlight};
    box-shadow: ${(props) =>
      `0 0 0 2px color-mix(in srgb, ${props.theme.highlight} 20%, transparent)`};
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
    props.$isEnabled
      ? `color-mix(in srgb, ${props.theme.highlight} 24%, transparent)`
      : props.theme.background};
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
  { label: "Tokyo Night", value: "tokyoNight" },
  { label: "T3 Code", value: "t3Code" },
  { label: "Catppuccin", value: "catppuccinMocha" },
  { label: "GitHub Dark", value: "githubDark" },
  { label: "One Dark Pro", value: "oneDarkPro" },
  { label: "Nord", value: "nord" },
  { label: "Rose Pine", value: "rosePine" },
  { label: "Gruvbox Dark", value: "gruvboxDark" },
  { label: "Ayu Mirage", value: "ayuMirage" },
]

function Settings() {
  const {
    themeMode,
    setThemeMode,
    enableNewTimeline,
    setEnableNewTimeline,
    startWithCompactSidebar,
    setStartWithCompactSidebar,
  } = useContext(AppPreferencesContext)

  return (
    <Container>
      <Header title="Settings" isDraggable />
      <SettingsContainer>
        <SettingsContent>
          <Section>
            <div>
              <SectionTitle>Theme</SectionTitle>
              <SectionDescription>Choose the Reactotron color theme.</SectionDescription>
            </div>
            <SelectWrap>
              <ThemeSelect
                value={themeMode}
                onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
              >
                {themeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </ThemeSelect>
            </SelectWrap>
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

          <Section>
            <div>
              <SectionTitle>Sidebar</SectionTitle>
              <SectionDescription>
                Start Reactotron with the compact left sidebar.
              </SectionDescription>
            </div>
            <PreferenceRow>
              <ToggleInput
                type="checkbox"
                checked={startWithCompactSidebar}
                onChange={(event) => setStartWithCompactSidebar(event.target.checked)}
              />
              <ToggleTrack $isEnabled={startWithCompactSidebar}>
                <ToggleThumb $isEnabled={startWithCompactSidebar} />
              </ToggleTrack>
            </PreferenceRow>
          </Section>
        </SettingsContent>
      </SettingsContainer>
    </Container>
  )
}

export default Settings
