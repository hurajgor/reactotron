import React, { ReactNode, useContext, useMemo, useState } from "react"
import { clipboard } from "electron"
import {
  MdOutlineContentCopy,
  MdOutlineDeleteSweep,
  MdOutlineInsertDriveFile,
  MdOutlineNetworkWifi,
  MdOutlineSearch,
} from "react-icons/md"
import styled from "styled-components"
import { ContentView, EmptyState, Header, ReactotronContext } from "reactotron-core-ui"
import type { ApiResponsePayload, Command, LogPayload } from "reactotron-core-contract"

type ConsoleKind = "network" | "log"
type BodyMode = "pretty" | "tree" | "raw"
type InspectorTab = "summary" | "request" | "response" | "headers" | "raw"
type LogLevel = "debug" | "info" | "warn" | "error"
type LogLevelSelection = Record<LogLevel, boolean>
type TableColumn = "kind" | "status" | "time"
type TableColumns = Record<TableColumn, number>
type TreeValueType = "string" | "number" | "boolean" | "null" | "undefined" | "object"

type ConsoleItem = {
  id: string
  kind: ConsoleKind
  command: Command
  title: string
  subtitle: string
  searchText: string
  method: string
  status: string
  tone: "good" | "warn" | "bad" | "muted" | "redirect"
  time: string
  duration?: number
}

type ApiRequest = Partial<ApiResponsePayload["request"]>
type ApiResponse = Partial<ApiResponsePayload["response"]>

const defaultLogLevels: LogLevelSelection = {
  debug: false,
  info: true,
  warn: true,
  error: true,
}

const defaultTableColumns: TableColumns = {
  kind: 92,
  status: 72,
  time: 96,
}

const verboseLogLevels: LogLevelSelection = {
  debug: true,
  info: true,
  warn: true,
  error: true,
}

const logLevelOptions: Array<{ level: LogLevel; label: string }> = [
  { level: "debug", label: "Verbose" },
  { level: "info", label: "Info" },
  { level: "warn", label: "Warnings" },
  { level: "error", label: "Errors" },
]

const treeValueColor: Record<TreeValueType, string> = {
  string: "#9ece6a",
  number: "#ff9e64",
  boolean: "#bb9af7",
  null: "#565f89",
  undefined: "#565f89",
  object: "#c0caf5",
}

const treePreviewLimit = 80

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
`

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.backgroundSubtleLight};
`

const ToolbarControls = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 10px;
  margin-left: auto;
  min-width: 0;
`

const ToggleCount = styled.span`
  color: ${(props) => props.theme.foregroundDark};
`

const SearchBox = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  flex-basis: 0;
  min-width: 220px;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 7px;
  background-color: ${(props) => props.theme.background};
  color: ${(props) => props.theme.foregroundDark};

  &:focus-within {
    border-color: ${(props) => props.theme.highlight};
    box-shadow: 0 0 0 2px rgba(122, 162, 247, 0.16);
  }
`

const SearchInput = styled.input`
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: ${(props) => props.theme.foreground};
  font-size: 13px;
`

const Toggle = styled.label`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 7px;
  color: ${(props) => props.theme.foreground};
  background-color: ${(props) => props.theme.background};
  font-size: 12px;
  cursor: pointer;

  input {
    margin: 0;
    accent-color: ${(props) => props.theme.highlight};
  }
`

const LogLevelMenu = styled.details`
  position: relative;
  flex: 0 0 190px;
  width: 190px;
  min-width: 0;
  color: ${(props) => props.theme.foreground};
  font-size: 12px;
`

const LogLevelSummary = styled.summary`
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 7px;
  background-color: ${(props) => props.theme.background};
  cursor: pointer;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }
`

const LogLevelValue = styled.span`
  min-width: 0;
  overflow: hidden;
  color: ${(props) => props.theme.foregroundDark};
  text-overflow: ellipsis;
  white-space: nowrap;
`

const LogLevelPanel = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 4;
  min-width: 190px;
  padding: 6px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 8px;
  background-color: ${(props) => props.theme.backgroundSubtleLight};
  box-shadow: 0 18px 36px rgba(15, 15, 25, 0.46);
`

const LogLevelAction = styled.button`
  display: block;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: ${(props) => props.theme.foreground};
  text-align: left;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background-color: ${(props) => props.theme.backgroundHighlight};
  }
`

const LogLevelDivider = styled.div`
  height: 1px;
  margin: 5px 0;
  background-color: ${(props) => props.theme.chromeLine};
`

const LogLevelOption = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 8px;
  border-radius: 3px;
  cursor: pointer;

  &:hover {
    background-color: ${(props) => props.theme.backgroundHighlight};
  }

  input {
    margin: 0;
    accent-color: ${(props) => props.theme.highlight};
  }
`

const Workspace = styled.div<{ $inspectorWidth: number }>`
  flex: 1;
  display: grid;
  grid-template-columns:
    minmax(120px, calc(100% - ${(props) => props.$inspectorWidth}px - 7px)) 7px
    minmax(240px, 1fr);
  min-height: 0;
  overflow: hidden;

  @media (max-width: 520px) {
    grid-template-columns:
      minmax(96px, calc(100% - ${(props) => props.$inspectorWidth}px - 7px)) 7px
      minmax(220px, 1fr);
  }
`

const EmptyTableState = styled.div`
  height: calc(100% - 33px);
  min-height: 240px;
  display: flex;
`

const EventTable = styled.div`
  min-width: 0;
  min-height: 0;
  overflow: auto;
  border-right: 1px solid ${(props) => props.theme.chromeLine};
`

const SplitResizeHandle = styled.div`
  position: relative;
  min-width: 7px;
  background-color: ${(props) => props.theme.chromeLine};
  cursor: col-resize;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 3px;
    width: 1px;
    background-color: rgba(122, 162, 247, 0.2);
  }

  &:hover {
    background-color: ${(props) => props.theme.highlight};
  }

  @media (max-width: 780px) {
    display: none;
  }
`

const TableGrid = styled.div<{ $columns: TableColumns }>`
  grid-template-columns:
    ${(props) => props.$columns.kind}px minmax(120px, 1fr)
    ${(props) => props.$columns.status}px ${(props) => props.$columns.time}px;
`

const TableHeader = styled(TableGrid)`
  position: sticky;
  top: 0;
  z-index: 1;
  display: grid;
  gap: 12px;
  padding: 9px 14px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.backgroundSubtleDark};
  color: ${(props) => props.theme.foregroundDark};
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
`

const TableHeaderCell = styled.span`
  position: relative;
  min-width: 0;
`

const ColumnResizeHandle = styled.button`
  position: absolute;
  top: -9px;
  right: -9px;
  bottom: -9px;
  width: 9px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  cursor: col-resize;

  &:hover {
    background-color: ${(props) => props.theme.highlight};
  }
`

const EventRow = styled(TableGrid)<{ $selected: boolean; $tone: ConsoleItem["tone"] }>`
  display: grid;
  gap: 12px;
  width: 100%;
  min-height: 54px;
  padding: 10px 14px;
  border: 0;
  border-bottom: 1px solid ${(props) => props.theme.line};
  border-left: 2px solid ${(props) => toneColor(props.$tone)};
  outline: 0;
  background-color: ${(props) => (props.$selected ? "rgba(122, 162, 247, 0.18)" : "transparent")};
  color: ${(props) => props.theme.foreground};
  text-align: left;
  cursor: pointer;

  &:hover {
    background-color: ${(props) =>
      props.$selected ? "rgba(122, 162, 247, 0.24)" : props.theme.backgroundSubtleLight};
  }
`

const Method = styled.strong<{ $kind: ConsoleKind }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: ${(props) => (props.$kind === "network" ? props.theme.support : props.theme.keyword)};
  font-size: 12px;
  line-height: 18px;
`

const EventTitle = styled.span`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;

  b,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  b {
    font-size: 13px;
    line-height: 18px;
  }

  small {
    color: ${(props) => props.theme.foregroundDark};
    font-size: 11px;
  }
`

const EndpointPath = styled.b`
  display: inline-flex;
  min-width: 0;
  overflow: hidden;
  color: ${(props) => props.theme.foregroundLight};
  text-overflow: ellipsis;
  white-space: nowrap;
`

const EndpointSegment = styled.span<{ $tone: number }>`
  min-width: 0;
  overflow: hidden;
  color: ${(props) => endpointSegmentColor(props.$tone)};
  text-overflow: ellipsis;
`

const EndpointSlash = styled.span`
  color: ${(props) => props.theme.foregroundDark};
`

const Status = styled.i<{ $tone: ConsoleItem["tone"] }>`
  align-self: center;
  justify-self: start;
  padding: 3px 7px;
  border-radius: 999px;
  color: ${(props) => toneColor(props.$tone)};
  background-color: rgba(65, 72, 104, 0.42);
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
`

const EmptyStatus = styled.span`
  align-self: center;
`

const Time = styled.small`
  align-self: center;
  justify-self: end;
  color: ${(props) => props.theme.foregroundDark};
  font-size: 11px;
`

const Inspector = styled.aside`
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background-color: ${(props) => props.theme.backgroundDarker};
`

const InspectorHeader = styled.div`
  padding: 14px 16px 12px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.background};

  @media (max-width: 560px) {
    padding: 12px 10px 10px;
  }
`

const InspectorEyebrow = styled.div`
  margin-bottom: 6px;
  color: ${(props) => props.theme.foregroundDark};
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
`

const InspectorTitle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  strong {
    min-width: 0;
    overflow: hidden;
    color: ${(props) => props.theme.foreground};
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }
`

const InspectorEndpoint = styled.strong`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: text;
`

const InspectorMeta = styled.div`
  margin-top: 6px;
  color: ${(props) => props.theme.foregroundDark};
  font-size: 12px;
`

const ActionBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.backgroundSubtleLight};

  @media (max-width: 560px) {
    padding: 8px 10px;
  }
`

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 7px;
  background-color: ${(props) => props.theme.background};
  color: ${(props) => props.theme.foreground};
  font-size: 12px;
  cursor: pointer;
  user-select: none;

  &:hover {
    border-color: ${(props) => props.theme.foregroundDark};
    background-color: ${(props) => props.theme.backgroundHighlight};
  }
`

const Tabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px 16px 0;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.background};

  @media (max-width: 560px) {
    padding: 8px 10px 0;
  }
`

const TabButton = styled.button<{ $active: boolean }>`
  flex: 0 0 auto;
  padding: 8px 10px;
  border: 0;
  border-bottom: 2px solid ${(props) => (props.$active ? props.theme.highlight : "transparent")};
  background: transparent;
  color: ${(props) => (props.$active ? props.theme.foreground : props.theme.foregroundDark)};
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
`

const ScrollPane = styled.div`
  min-height: 0;
  overflow: auto;
  padding: 16px;
  user-select: text;

  @media (max-width: 560px) {
    padding: 10px;
  }
`

const Section = styled.section`
  margin-bottom: 18px;
`

const SectionTitle = styled.h3`
  margin: 0 0 10px;
  color: ${(props) => props.theme.bold};
  font-size: 12px;
  text-transform: uppercase;
`

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 7px;
  overflow: hidden;
  user-select: text;
`

const FieldLabel = styled.div`
  padding: 8px 10px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.backgroundSubtleDark};
  color: ${(props) => props.theme.foregroundDark};
  font-size: 12px;
`

const FieldValue = styled.div`
  min-width: 0;
  padding: 8px 10px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  color: ${(props) => props.theme.foreground};
  font-size: 12px;
  overflow-wrap: anywhere;
`

const ViewerContainer = styled.div`
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 7px;
  overflow: hidden;
  user-select: text;
`

const ViewerHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.backgroundSubtleLight};
`

const ViewerTools = styled.div`
  display: flex;
  flex: 1 1 180px;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

const ViewerModes = styled.div`
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
`

const ViewerSearch = styled.label`
  display: flex;
  flex: 1 1 130px;
  align-items: center;
  gap: 6px;
  min-width: 112px;
  max-width: 220px;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 6px;
  background-color: ${(props) => props.theme.background};
  color: ${(props) => props.theme.foregroundDark};
`

const ViewerSearchInput = styled.input`
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: ${(props) => props.theme.foreground};
  font-size: 11px;
`

const MatchCount = styled.span`
  color: ${(props) => props.theme.foregroundDark};
  font-size: 11px;
  white-space: nowrap;
`

const ModeButton = styled.button<{ $active: boolean }>`
  flex: 0 0 auto;
  padding: 4px 8px;
  border: 1px solid ${(props) => (props.$active ? props.theme.highlight : props.theme.chromeLine)};
  border-radius: 6px;
  background-color: ${(props) =>
    props.$active ? "rgba(122, 162, 247, 0.18)" : props.theme.background};
  color: ${(props) => props.theme.foreground};
  font-size: 11px;
  cursor: pointer;
`

const CodeBlock = styled.pre`
  margin: 0;
  min-height: 180px;
  max-height: 520px;
  overflow: auto;
  padding: 12px;
  color: ${(props) => props.theme.foreground};
  background-color: ${(props) => props.theme.backgroundSubtleDark};
  font-size: 12px;
  line-height: 18px;
  user-select: text;
  white-space: pre-wrap;
  word-break: break-word;
`

const JsonKey = styled.span`
  color: #7dcfff;
`

const JsonString = styled.span`
  color: #9ece6a;
`

const JsonNumber = styled.span`
  color: #ff9e64;
`

const JsonBoolean = styled.span`
  color: #bb9af7;
`

const JsonNull = styled.span`
  color: #bb9af7;
`

const JsonPunctuation = styled.span`
  color: #565f89;
`

const Highlight = styled.mark`
  padding: 0;
  color: inherit;
  background-color: rgba(224, 175, 104, 0.45);
`

const TreeBody = styled.div`
  min-height: 180px;
  max-height: 520px;
  overflow: auto;
  padding: 12px;
  color: ${(props) => props.theme.foreground};
  background-color: ${(props) => props.theme.backgroundSubtleDark};
  font-size: 12px;
  line-height: 20px;
  user-select: text;
`

const TreeNode = styled.div<{ $depth: number }>`
  margin-left: ${(props) => props.$depth * 14}px;
`

const TreeNodeSummary = styled.summary`
  cursor: pointer;
  list-style: disclosure-closed;

  &::-webkit-details-marker {
    color: ${(props) => props.theme.foregroundDark};
  }
`

const TreeKey = styled.span`
  color: #7dcfff;
`

const TreeIndex = styled.span`
  color: #bb9af7;
`

const TreeSummary = styled.span`
  color: #c0caf5;
`

const TreeValue = styled.span<{ $type: TreeValueType }>`
  color: ${(props) => treeValueColor[props.$type]};
`

const TreePrimitiveRow = styled.div<{ $depth: number }>`
  margin-left: ${(props) => props.$depth * 14}px;
`

const TreeMoreRow = styled.div<{ $depth: number }>`
  margin-left: ${(props) => props.$depth * 14}px;
  color: ${(props) => props.theme.foregroundDark};
`

const TreeMoreButton = styled.button`
  margin-left: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${(props) => props.theme.highlight};
  font: inherit;
  cursor: pointer;
  user-select: none;

  &:hover {
    color: ${(props) => props.theme.foregroundLight};
  }
`

const ArgumentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const LogHighlights = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
`

const LogHighlightItem = styled.button`
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 4px;
  background-color: ${(props) => props.theme.backgroundSubtleDark};
  color: ${(props) => props.theme.foreground};
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: ${(props) => props.theme.foregroundDark};
    background-color: ${(props) => props.theme.backgroundHighlight};
  }

  span {
    margin-right: 6px;
    color: ${(props) => props.theme.foregroundDark};
  }
`

const ArgumentHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: ${(props) => props.theme.foregroundDark};
  font-size: 12px;
`

const ArgumentBadge = styled.span`
  padding: 2px 6px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 3px;
  color: ${(props) => props.theme.foreground};
  background-color: ${(props) => props.theme.backgroundSubtleDark};
  font-size: 11px;
`

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function resizeInspector(
  event: React.MouseEvent,
  currentWidth: number,
  setInspectorWidth: React.Dispatch<React.SetStateAction<number>>
) {
  event.preventDefault()
  const startX = event.clientX
  const startWidth = currentWidth

  const onMouseMove = (moveEvent: MouseEvent) => {
    setInspectorWidth(clamp(startWidth + startX - moveEvent.clientX, 240, 900))
  }

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove)
    document.removeEventListener("mouseup", onMouseUp)
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }

  document.body.style.cursor = "col-resize"
  document.body.style.userSelect = "none"
  document.addEventListener("mousemove", onMouseMove)
  document.addEventListener("mouseup", onMouseUp)
}

function resizeTableColumn(
  event: React.MouseEvent,
  column: TableColumn,
  tableColumns: TableColumns,
  setTableColumns: React.Dispatch<React.SetStateAction<TableColumns>>
) {
  event.preventDefault()
  event.stopPropagation()

  const startX = event.clientX
  const startWidth = tableColumns[column]

  const limits: Record<TableColumn, { min: number; max: number }> = {
    kind: { min: 58, max: 150 },
    status: { min: 58, max: 130 },
    time: { min: 62, max: 170 },
  }

  const onMouseMove = (moveEvent: MouseEvent) => {
    const nextWidth = clamp(
      startWidth + moveEvent.clientX - startX,
      limits[column].min,
      limits[column].max
    )
    setTableColumns((columns) => ({ ...columns, [column]: nextWidth }))
  }

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove)
    document.removeEventListener("mouseup", onMouseUp)
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }

  document.body.style.cursor = "col-resize"
  document.body.style.userSelect = "none"
  document.addEventListener("mousemove", onMouseMove)
  document.addEventListener("mouseup", onMouseUp)
}

function Network({ title = "Network" }: { title?: string }) {
  const { clearCommands, commands } = useContext(ReactotronContext)
  const [query, setQuery] = useState("")
  const [showNetwork, setShowNetwork] = useState(true)
  const [showLogs, setShowLogs] = useState(true)
  const [logLevels, setLogLevels] = useState<LogLevelSelection>(defaultLogLevels)
  const [selectedId, setSelectedId] = useState<string>("")
  const [inspectorWidth, setInspectorWidth] = useState(560)
  const [tableColumns, setTableColumns] = useState<TableColumns>(defaultTableColumns)

  const items = useMemo(() => buildItems(commands), [commands])
  const networkCount = useMemo(
    () => items.filter((item) => item.kind === "network").length,
    [items]
  )
  const logCount = useMemo(() => items.filter((item) => item.kind === "log").length, [items])
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items
      .filter((item) => (item.kind === "network" ? showNetwork : showLogs))
      .filter((item) => item.kind !== "log" || logLevels[item.status as LogLevel])
      .filter((item) => {
        if (!needle) return true
        return item.searchText.toLowerCase().includes(needle)
      })
  }, [items, logLevels, query, showLogs, showNetwork])
  const filteredItemCount = items.length - visibleItems.length

  const selectedItem = selectedId
    ? visibleItems.find((item) => item.id === selectedId) ?? null
    : null

  return (
    <Container>
      <Header title={title} isDraggable />
      <Toolbar>
        <SearchBox>
          <MdOutlineSearch size={16} />
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search endpoints, logs, status, hosts"
          />
        </SearchBox>
        <ToolbarControls>
          <Toggle>
            <input
              type="checkbox"
              checked={showNetwork}
              onChange={(event) => setShowNetwork(event.target.checked)}
            />
            Network <ToggleCount>{networkCount}</ToggleCount>
          </Toggle>
          <Toggle>
            <input
              type="checkbox"
              checked={showLogs}
              onChange={(event) => setShowLogs(event.target.checked)}
            />
            Logs <ToggleCount>{logCount}</ToggleCount>
          </Toggle>
          <LogLevelFilter levels={logLevels} setLevels={setLogLevels} />
          <ActionButton
            type="button"
            onClick={() => {
              clearCommands()
              setSelectedId("")
            }}
          >
            <MdOutlineDeleteSweep size={14} />
            Clear
          </ActionButton>
        </ToolbarControls>
      </Toolbar>
      <Workspace $inspectorWidth={inspectorWidth}>
        <EventTable>
          <TableHeader $columns={tableColumns}>
            <TableHeaderCell>
              Kind
              <ColumnResizeHandle
                type="button"
                title="Resize kind column"
                onMouseDown={(event) =>
                  resizeTableColumn(event, "kind", tableColumns, setTableColumns)
                }
              />
            </TableHeaderCell>
            <TableHeaderCell>Event</TableHeaderCell>
            <TableHeaderCell>
              Status
              <ColumnResizeHandle
                type="button"
                title="Resize status column"
                onMouseDown={(event) =>
                  resizeTableColumn(event, "status", tableColumns, setTableColumns)
                }
              />
            </TableHeaderCell>
            <TableHeaderCell>
              Time
              <ColumnResizeHandle
                type="button"
                title="Resize time column"
                onMouseDown={(event) =>
                  resizeTableColumn(event, "time", tableColumns, setTableColumns)
                }
              />
            </TableHeaderCell>
          </TableHeader>
          {visibleItems.length === 0 ? (
            <EmptyTableState>
              <EmptyState icon={MdOutlineNetworkWifi} title="No Network Activity">
                {items.length > 0 && filteredItemCount > 0
                  ? "Events are currently hidden by the active search, type, or log-level filters."
                  : "Network requests and logs will appear here once your app connects on the active Reactotron port."}
              </EmptyState>
            </EmptyTableState>
          ) : (
            visibleItems.map((item) => (
              <EventRow
                key={item.id}
                as="button"
                type="button"
                $columns={tableColumns}
                $selected={selectedItem?.id === item.id}
                $tone={item.tone}
                onClick={() => setSelectedId(item.id)}
              >
                <Method $kind={item.kind}>
                  {item.kind === "network" ? (
                    <MdOutlineNetworkWifi size={14} />
                  ) : (
                    <MdOutlineInsertDriveFile size={14} />
                  )}
                  {item.method}
                </Method>
                <EventTitle>
                  {item.kind === "network" ? renderEndpointPath(item.title) : <b>{item.title}</b>}
                  {item.subtitle ? <small>{item.subtitle}</small> : null}
                </EventTitle>
                {item.kind === "network" ? (
                  <Status $tone={item.tone}>{item.status}</Status>
                ) : (
                  <EmptyStatus />
                )}
                <Time>{item.time}</Time>
              </EventRow>
            ))
          )}
        </EventTable>
        <SplitResizeHandle
          role="separator"
          aria-orientation="vertical"
          title="Resize inspector"
          onMouseDown={(event) => resizeInspector(event, inspectorWidth, setInspectorWidth)}
        />
        <Inspector>
          {selectedItem ? (
            <ConsoleInspector item={selectedItem} />
          ) : (
            <EmptyState icon={MdOutlineNetworkWifi} title="Select An Event">
              Choose a request or log to inspect its details.
            </EmptyState>
          )}
        </Inspector>
      </Workspace>
    </Container>
  )
}

function LogLevelFilter({
  levels,
  setLevels,
}: {
  levels: LogLevelSelection
  setLevels: React.Dispatch<React.SetStateAction<LogLevelSelection>>
}) {
  const toggleLevel = (level: LogLevel) => {
    setLevels((current) => ({ ...current, [level]: !current[level] }))
  }

  return (
    <LogLevelMenu>
      <LogLevelSummary>
        <span>Log level</span>
        <LogLevelValue>{logLevelSelectionLabel(levels)}</LogLevelValue>
      </LogLevelSummary>
      <LogLevelPanel>
        <LogLevelAction type="button" onClick={() => setLevels(defaultLogLevels)}>
          Default
        </LogLevelAction>
        <LogLevelAction type="button" onClick={() => setLevels(verboseLogLevels)}>
          Verbose
        </LogLevelAction>
        <LogLevelDivider />
        {logLevelOptions.map((option) => (
          <LogLevelOption key={option.level}>
            <input
              type="checkbox"
              checked={levels[option.level]}
              onChange={() => toggleLevel(option.level)}
            />
            {option.label}
          </LogLevelOption>
        ))}
      </LogLevelPanel>
    </LogLevelMenu>
  )
}

function ConsoleInspector({ item }: { item: ConsoleItem }) {
  return item.kind === "network" ? <NetworkInspector item={item} /> : <LogInspector item={item} />
}

function NetworkInspector({ item }: { item: ConsoleItem }) {
  const [tab, setTab] = useState<InspectorTab>("response")
  const payload = item.command.payload as ApiResponsePayload
  const request: ApiRequest = payload.request ?? {}
  const response: ApiResponse = payload.response ?? {}
  const responseCopyText = useMemo(() => formatBody(response.body), [response.body])
  const requestCopyText = useMemo(() => formatBody(request.data), [request.data])
  const curlCopyText = useMemo(() => apiRequestToCurl(payload), [payload])
  const eventCopyText = useMemo(() => JSON.stringify(item.command, null, 2), [item.command])

  return (
    <>
      <InspectorHeader>
        <InspectorEyebrow>Network request</InspectorEyebrow>
        <InspectorTitle>
          <InspectorEndpoint title={request.url}>
            {renderEndpointPath(item.title)}
          </InspectorEndpoint>
          <Status $tone={item.tone}>{item.status}</Status>
        </InspectorTitle>
      </InspectorHeader>
      <ActionBar>
        <CopyButton text={responseCopyText}>Copy response</CopyButton>
        <CopyButton text={requestCopyText}>Copy request</CopyButton>
        <CopyButton text={curlCopyText}>Copy cURL</CopyButton>
        <CopyButton text={eventCopyText}>Copy event</CopyButton>
      </ActionBar>
      <Tabs>
        {(["summary", "request", "response", "headers", "raw"] as InspectorTab[]).map((value) => (
          <TabButton
            key={value}
            type="button"
            $active={tab === value}
            onClick={() => setTab(value)}
          >
            {labelForTab(value)}
          </TabButton>
        ))}
      </Tabs>
      <ScrollPane>{renderNetworkTab(tab, payload, item.command)}</ScrollPane>
    </>
  )
}

function LogInspector({ item }: { item: ConsoleItem }) {
  const [tab, setTab] = useState<"message" | "raw">("message")
  const payload = item.command.payload as LogPayload
  const args = useMemo(
    () => normalizeLogArgs(payload.message).map(normalizeLogArgument),
    [payload.message]
  )
  const logCopyText = useMemo(() => formatLogForCopy(args), [args])
  const eventCopyText = useMemo(() => JSON.stringify(item.command, null, 2), [item.command])

  return (
    <>
      <InspectorHeader>
        <InspectorEyebrow>Log event</InspectorEyebrow>
        <InspectorTitle>
          <strong>{item.title}</strong>
        </InspectorTitle>
        <InspectorMeta>
          {displayLogLevel(payload.level)} - {formatDate(item.command.date)} - message{" "}
          {item.command.messageId}
        </InspectorMeta>
      </InspectorHeader>
      <ActionBar>
        <CopyButton text={logCopyText}>Copy log</CopyButton>
        <CopyButton text={eventCopyText}>Copy event</CopyButton>
      </ActionBar>
      <Tabs>
        <TabButton type="button" $active={tab === "message"} onClick={() => setTab("message")}>
          Message
        </TabButton>
        <TabButton type="button" $active={tab === "raw"} onClick={() => setTab("raw")}>
          Raw
        </TabButton>
      </Tabs>
      <ScrollPane>
        {tab === "message" ? (
          <>
            {args.length > 1 ? (
              <LogDetails args={args} />
            ) : (
              <PayloadViewer label="Message" value={args[0]?.value} />
            )}
            {"stack" in payload && <PayloadViewer label="Stack" value={payload.stack} />}
          </>
        ) : (
          <PayloadViewer label="Raw event" value={item.command} />
        )}
      </ScrollPane>
    </>
  )
}

type LogArgument = {
  value: unknown
  parsedFromString: boolean
  original: unknown
  role?: "message" | "payload" | "event" | "extra"
}

type ExpandedLogPart = {
  __reactotronLogPart: true
  role: LogArgument["role"]
  value: unknown
}

function logParts(args: LogArgument[]) {
  const payload =
    args.find((arg) => arg.role === "payload") ??
    args.find((arg, index) => index > 0 && arg.value && typeof arg.value === "object")
  const event =
    args.find((arg) => arg.role === "event") ??
    args.find((arg, index) => index > 0 && arg !== payload && typeof arg.value === "string")
  const rest = args.filter((arg, index) => index > 0 && arg !== event && arg !== payload)

  return { event, payload, rest }
}

function LogDetails({ args }: { args: LogArgument[] }) {
  const parts = logParts(args)
  const highlightItems = buildLogHighlightItems(parts.event?.value, parts.payload?.value)

  return (
    <>
      {highlightItems.length > 0 ? (
        <Section>
          <SectionTitle>Highlights</SectionTitle>
          <LogHighlights>
            {highlightItems.map((item) => (
              <LogHighlightChip key={item.label} label={item.label} value={item.value} />
            ))}
          </LogHighlights>
        </Section>
      ) : null}
      <PayloadViewer label="Payload" value={parts.payload?.value ?? args[args.length - 1]?.value} />
      {parts.rest.length > 0 ? (
        <Section>
          <SectionTitle>More</SectionTitle>
          <ArgumentList>
            {parts.rest.map((arg, index) => (
              <div key={index}>
                <ArgumentHeader>
                  <ArgumentBadge>{logArgumentLabel(index + 3, args.length)}</ArgumentBadge>
                  <span>{argumentTypeLabel(arg)}</span>
                </ArgumentHeader>
                <PayloadViewer label="" value={arg.value} />
              </div>
            ))}
          </ArgumentList>
        </Section>
      ) : null}
    </>
  )
}

function LogHighlightChip({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <LogHighlightItem
      type="button"
      title={`Copy ${label}`}
      onClick={() => {
        clipboard.writeText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 900)
      }}
    >
      <span>{label}</span>
      {copied ? "Copied" : value}
    </LogHighlightItem>
  )
}

function PayloadViewer({ label, value }: { label: string; value: unknown }) {
  const [mode, setMode] = useState<BodyMode>("pretty")
  const [search, setSearch] = useState("")
  const parsed = useMemo(() => parseBody(value), [value])
  const prettyText = useMemo(() => formatBody(value), [value])
  const rawText = useMemo(
    () => (typeof value === "string" ? value : JSON.stringify(value, null, 2)),
    [value]
  )
  const canTree = parsed !== undefined && parsed !== null && typeof parsed === "object"
  const visibleText = mode === "raw" ? rawText : prettyText
  const matchCount = useMemo(() => countMatches(visibleText, search), [visibleText, search])
  const treeValue = useMemo(
    () => (search && canTree ? filterJsonValue(parsed, search) : parsed),
    [canTree, parsed, search]
  )
  const codeContent = useMemo(() => renderCodeText(visibleText, search), [visibleText, search])

  return (
    <Section>
      {label ? <SectionTitle>{label}</SectionTitle> : null}
      <ViewerContainer>
        <ViewerHeader>
          <ViewerTools>
            <ViewerModes>
              <ModeButton
                type="button"
                $active={mode === "pretty"}
                onClick={() => setMode("pretty")}
              >
                Pretty
              </ModeButton>
              <ModeButton
                type="button"
                $active={mode === "tree"}
                onClick={() => setMode("tree")}
                disabled={!canTree}
              >
                Tree
              </ModeButton>
              <ModeButton type="button" $active={mode === "raw"} onClick={() => setMode("raw")}>
                Raw
              </ModeButton>
            </ViewerModes>
            <ViewerSearch>
              <MdOutlineSearch size={13} />
              <ViewerSearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find in JSON"
              />
            </ViewerSearch>
            {search && <MatchCount>{matchCount} matches</MatchCount>}
          </ViewerTools>
          <CopyButton text={visibleText}>Copy</CopyButton>
        </ViewerHeader>
        {mode === "tree" && canTree ? (
          <TreeBody>
            <JsonTree value={treeValue} />
          </TreeBody>
        ) : (
          <CodeBlock>{codeContent}</CodeBlock>
        )}
      </ViewerContainer>
    </Section>
  )
}

function JsonTree({ value, depth = 0, name }: { value: unknown; depth?: number; name?: string }) {
  const [open, setOpen] = useState(depth < 2)
  const [showAll, setShowAll] = useState(false)

  if (!value || typeof value !== "object") {
    return (
      <TreePrimitiveRow $depth={depth}>
        {name ? renderTreeKey(name) : null}
        <TreeValue $type={treeValueType(value)}>{formatTreePrimitive(value)}</TreeValue>
      </TreePrimitiveRow>
    )
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>)
  const visibleEntries = showAll ? entries : entries.slice(0, treePreviewLimit)
  const label = name ?? (Array.isArray(value) ? "Array" : "Object")
  const summary = Array.isArray(value) ? `Array(${entries.length})` : `{${entries.length}}`
  const hiddenCount = entries.length - visibleEntries.length

  return (
    <TreeNode $depth={depth}>
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <TreeNodeSummary>
          {name ? renderTreeKey(label) : null}
          <TreeSummary>{summary}</TreeSummary>
        </TreeNodeSummary>
        {open
          ? visibleEntries.map(([key, item]) => (
              <JsonTree key={key} name={key} value={item} depth={depth + 1} />
            ))
          : null}
        {open && hiddenCount > 0 ? (
          <TreeMoreRow $depth={depth + 1}>
            ... {hiddenCount} more items
            <TreeMoreButton
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setShowAll(true)
              }}
            >
              show all
            </TreeMoreButton>
          </TreeMoreRow>
        ) : null}
      </details>
    </TreeNode>
  )
}

function renderTreeKey(name: string) {
  return /^\d+$/.test(name) ? <TreeIndex>{name}: </TreeIndex> : <TreeKey>{name}: </TreeKey>
}

function treeValueType(value: unknown): TreeValueType {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "string") return "string"
  if (typeof value === "number") return "number"
  if (typeof value === "boolean") return "boolean"
  return "object"
}

function formatTreePrimitive(value: unknown) {
  if (typeof value === "string") return `"${value}"`
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  return String(value)
}

function CopyButton({ text, children }: { text: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false)

  return (
    <ActionButton
      type="button"
      onClick={() => {
        clipboard.writeText(text ?? "")
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1100)
      }}
    >
      <MdOutlineContentCopy size={14} />
      {copied ? "Copied" : children}
    </ActionButton>
  )
}

function renderNetworkTab(tab: InspectorTab, payload: ApiResponsePayload, command: Command) {
  const request: ApiRequest = payload.request ?? {}
  const response: ApiResponse = payload.response ?? {}

  switch (tab) {
    case "summary":
      return (
        <Section>
          <SectionTitle>Summary</SectionTitle>
          <FieldTable
            rows={[
              ["URL", request.url],
              ["Method", request.method],
              ["Status", response.status],
              ["Duration", payload.duration != null ? `${payload.duration} ms` : ""],
              ["Time", formatDate(command.date)],
              ["Message ID", command.messageId],
            ]}
          />
        </Section>
      )
    case "request":
      return (
        <>
          <Section>
            <SectionTitle>Query Params</SectionTitle>
            <ContentView value={request.params ?? queryParams(request.url)} />
          </Section>
          <PayloadViewer label="Request body" value={request.data ?? ""} />
        </>
      )
    case "response":
      return <PayloadViewer label="Response body" value={response.body ?? ""} />
    case "headers":
      return (
        <>
          <Section>
            <SectionTitle>Request Headers</SectionTitle>
            <ContentView value={request.headers ?? {}} copyToClipboard={clipboard.writeText} />
          </Section>
          <Section>
            <SectionTitle>Response Headers</SectionTitle>
            <ContentView value={response.headers ?? {}} copyToClipboard={clipboard.writeText} />
          </Section>
        </>
      )
    case "raw":
      return <PayloadViewer label="Raw event" value={command} />
  }
}

function FieldTable({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <FieldGrid>
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <FieldLabel>{label}</FieldLabel>
          <FieldValue>{String(value ?? "")}</FieldValue>
        </React.Fragment>
      ))}
    </FieldGrid>
  )
}

function buildItems(commands: Command[]): ConsoleItem[] {
  return commands
    .filter((command) => command.type === "api.response" || command.type === "log")
    .map((command) => (command.type === "api.response" ? networkItem(command) : logItem(command)))
}

function networkItem(command: Command): ConsoleItem {
  const payload = command.payload as ApiResponsePayload
  const request: ApiRequest = payload.request ?? {}
  const response: ApiResponse = payload.response ?? {}
  const status = response.status
  const url = String(request.url ?? "")

  return {
    id: String(command.messageId),
    kind: "network",
    command,
    title: urlPath(url),
    subtitle: hostName(url),
    searchText: [request.method, url, hostName(url), response.status, payload.duration]
      .map(searchableText)
      .join(" "),
    method: String(request.method ?? "HTTP").toUpperCase(),
    status: status == null ? "pending" : String(status),
    tone: toneForStatus(status),
    time: payload.duration != null ? formatDuration(payload.duration) : formatTime(command.date),
    duration: payload.duration,
  }
}

function logItem(command: Command): ConsoleItem {
  const payload = command.payload as LogPayload
  const level = payload?.level ?? "log"
  const message = payload?.message
  const title = formatLogPreview(message)
  const subtitle = formatLogSubtitlePreview(message)

  return {
    id: String(command.messageId),
    kind: "log",
    command,
    title,
    subtitle,
    searchText: [displayLogLevel(level), normalizeLogLevel(level), title, subtitle]
      .map(searchableText)
      .join(" "),
    method: displayLogLevel(level),
    status: normalizeLogLevel(level),
    tone: toneForLogLevel(level),
    time: formatTime(command.date),
  }
}

function labelForTab(tab: InspectorTab) {
  switch (tab) {
    case "summary":
      return "Summary"
    case "request":
      return "Request"
    case "response":
      return "Response"
    case "headers":
      return "Headers"
    case "raw":
      return "Raw"
  }
}

function toneForStatus(status: unknown): ConsoleItem["tone"] {
  const code = Number(status)
  if (!Number.isFinite(code)) return "muted"
  if (code >= 500) return "bad"
  if (code >= 400) return "warn"
  if (code >= 300) return "redirect"
  if (code >= 200) return "good"
  return "muted"
}

function toneForLogLevel(level: unknown): ConsoleItem["tone"] {
  const text = normalizeLogLevel(level)
  if (text === "error") return "bad"
  if (text === "warn") return "warn"
  return "muted"
}

function normalizeLogLevel(level: unknown): LogLevel {
  const text = String(level ?? "").toLowerCase()
  if (text === "error") return "error"
  if (text === "warn" || text === "warning") return "warn"
  if (text === "info" || text === "log") return "info"
  return "debug"
}

function displayLogLevel(level: unknown) {
  const normalized = normalizeLogLevel(level)
  if (normalized === "debug") return "DEBUG"
  if (normalized === "info") return "INFO"
  if (normalized === "warn") return "WARN"
  return "ERROR"
}

function logLevelSelectionLabel(levels: LogLevelSelection) {
  if (logLevelSelectionsEqual(levels, defaultLogLevels)) return "Default"
  if (logLevelSelectionsEqual(levels, verboseLogLevels)) return "Verbose"

  const selected = logLevelOptions
    .filter((option) => levels[option.level])
    .map((option) => option.label)

  return selected.length > 0 ? selected.join(", ") : "None"
}

function logLevelSelectionsEqual(left: LogLevelSelection, right: LogLevelSelection) {
  return logLevelOptions.every((option) => left[option.level] === right[option.level])
}

function normalizeLogArgs(message: unknown) {
  const value = unwrapSerializedLogMessage(message)
  const args = Array.isArray(value) ? value : [value]
  return args.flatMap(expandEmbeddedJsonArgument)
}

function expandEmbeddedJsonArgument(value: unknown): unknown[] {
  if (typeof value !== "string") return [value]

  const embedded = extractEmbeddedJson(value)
  if (!embedded) return [value]

  const parts: unknown[] = []
  const messageText = `${embedded.before} ${embedded.after}`.trim()
  if (messageText) parts.push({ __reactotronLogPart: true, role: "message", value: messageText })
  parts.push({ __reactotronLogPart: true, role: "payload", value: embedded.value })

  return parts
}

function normalizeLogArgument(value: unknown): LogArgument {
  if (
    value &&
    typeof value === "object" &&
    "__reactotronLogPart" in value &&
    (value as { __reactotronLogPart?: unknown }).__reactotronLogPart === true &&
    "role" in value &&
    "value" in value &&
    isLogArgumentRole((value as { role?: unknown }).role)
  ) {
    const expanded = value as ExpandedLogPart
    return {
      value: expanded.value,
      parsedFromString: true,
      original: value,
      role: expanded.role,
    }
  }

  if (typeof value !== "string") {
    return { value, parsedFromString: false, original: value }
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return { value, parsedFromString: false, original: value }
  }

  if (
    !(
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    )
  ) {
    return { value, parsedFromString: false, original: value }
  }

  try {
    return { value: JSON.parse(trimmed), parsedFromString: true, original: value }
  } catch {
    return { value, parsedFromString: false, original: value }
  }
}

function isLogArgumentRole(value: unknown): value is LogArgument["role"] {
  return value === "message" || value === "payload" || value === "event" || value === "extra"
}

function extractEmbeddedJson(text: string):
  | {
      before: string
      after: string
      value: unknown
    }
  | undefined {
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char !== "{" && char !== "[") continue

    const end = findJsonEnd(text, index)
    if (end === -1) continue

    const candidate = text.slice(index, end + 1)
    try {
      return {
        before: text.slice(0, index).trim(),
        after: text.slice(end + 1).trim(),
        value: JSON.parse(candidate),
      }
    } catch {
      continue
    }
  }

  return undefined
}

function findJsonEnd(text: string, start: number) {
  const opening = text[start]
  const closing = opening === "{" ? "}" : "]"
  const stack = [closing]
  let inString = false
  let escaped = false

  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === "\\") {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === "{" || char === "[") {
      stack.push(char === "{" ? "}" : "]")
      continue
    }

    if (char === "}" || char === "]") {
      if (char !== stack[stack.length - 1]) return -1
      stack.pop()
      if (stack.length === 0) return index
    }
  }

  return -1
}

function argumentTypeLabel(arg: LogArgument) {
  if (arg.role === "payload") return "JSON parsed from message"
  if (arg.parsedFromString) return "JSON string parsed for viewing"
  if (Array.isArray(arg.value)) return "array"
  if (arg.value === null) return "null"
  return typeof arg.value
}

function logArgumentLabel(index: number, total: number) {
  if (total > 1 && index === 0) return "message"
  if (total > 1 && index === total - 1) return "payload"
  if (total > 1 && index === 1) return "event"
  return `arg ${index + 1}`
}

function formatLogForCopy(args: LogArgument[]) {
  return args.map((arg) => formatBody(arg.value)).join(" ")
}

function unwrapSerializedLogMessage(message: unknown): unknown {
  if (typeof message !== "string") return message

  const trimmed = message.trim()
  if (!trimmed) return message

  try {
    return JSON.parse(trimmed)
  } catch {
    return message
  }
}

function formatLogPreview(message: unknown) {
  const value = Array.isArray(message) ? message[0] : message

  if (typeof value === "string") return value.slice(0, 500)
  if (value instanceof Error) return value.message.slice(0, 500)

  return formatCompactLogValue(value).slice(0, 500)
}

function formatLogSubtitlePreview(message: unknown) {
  if (!Array.isArray(message) || message.length <= 1) return ""

  return message
    .slice(1, 4)
    .map((item) => formatCompactLogValue(item))
    .filter(Boolean)
    .join(" | ")
}

function buildLogHighlightItems(event: unknown, payload: unknown) {
  const items: Array<{ label: string; value: string }> = []
  const eventName = formatCompactLogValue(event)
  if (eventName) items.push({ label: "event", value: eventName })

  for (const item of payloadSignalEntries(payload).slice(0, 6)) {
    items.push(item)
  }

  return items
}

function payloadSignalEntries(value: unknown): Array<{ label: string; value: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []

  const record = value as Record<string, unknown>
  const preferredKeys = [
    "FORMATNAME",
    "BID",
    "ASK",
    "CURBID",
    "LOTNO",
    "ITEMNO",
    "BUYERNO",
    "BUYERST",
    "MINMET",
    "TYPE",
  ]

  const preferredEntries = preferredKeys
    .filter((key) => record[key] != null && String(record[key]) !== "")
    .map((key) => ({ label: key, value: String(record[key]) }))

  if (preferredEntries.length > 0) return preferredEntries

  return Object.entries(record)
    .filter(([, entryValue]) => isCompactSignalValue(entryValue))
    .slice(0, 8)
    .map(([key, entryValue]) => ({ label: key, value: String(entryValue) }))
}

function isCompactSignalValue(value: unknown) {
  if (value == null || value === "") return false
  return ["string", "number", "boolean"].includes(typeof value)
}

function formatCompactLogValue(value: unknown) {
  if (typeof value === "string") return value
  if (value instanceof Error) return value.message
  if (Array.isArray(value)) return `Array(${value.length})`
  if (value && typeof value === "object") {
    const keys = Object.keys(value).slice(0, 4)
    const suffix = Object.keys(value).length > keys.length ? ", ..." : ""
    return `{ ${keys.join(", ")}${suffix} }`
  }
  return String(value)
}

function toneColor(tone: ConsoleItem["tone"]) {
  switch (tone) {
    case "good":
      return "#7aa2f7"
    case "warn":
      return "#bb9af7"
    case "bad":
      return "#bb9af7"
    case "redirect":
      return "#7dcfff"
    default:
      return "#565f89"
  }
}

function endpointSegmentColor(index: number) {
  const colors = ["#7dcfff", "#7aa2f7", "#bb9af7", "#9ece6a", "#c0caf5"]
  return colors[index % colors.length]
}

function renderEndpointPath(path: string) {
  const [pathname, query] = path.split("?")
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) {
    return <EndpointPath>{path}</EndpointPath>
  }

  return (
    <EndpointPath>
      {pathname.startsWith("/") ? <EndpointSlash>/</EndpointSlash> : null}
      {segments.map((segment, index) => (
        <React.Fragment key={`${segment}-${index}`}>
          {index > 0 ? <EndpointSlash>/</EndpointSlash> : null}
          <EndpointSegment $tone={index}>{segment}</EndpointSegment>
        </React.Fragment>
      ))}
      {query ? (
        <>
          <EndpointSlash>?</EndpointSlash>
          <EndpointSegment $tone={segments.length}>{query}</EndpointSegment>
        </>
      ) : null}
    </EndpointPath>
  )
}

function urlPath(value: string) {
  if (!value) return "Network request"
  try {
    const url = new URL(value)
    return `${url.pathname}${url.search}`
  } catch {
    return value
  }
}

function hostName(value: string) {
  try {
    return new URL(value).host
  } catch {
    return value
  }
}

function queryParams(value: unknown) {
  try {
    const url = new URL(String(value ?? ""))
    return Object.fromEntries(url.searchParams.entries())
  } catch {
    return {}
  }
}

function parseBody(value: unknown) {
  if (value === null || value === undefined) return value
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function formatBody(value: unknown) {
  const parsed = parseBody(value)
  if (parsed !== undefined) {
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2)
  }
  if (typeof value === "string") return value
  return JSON.stringify(value, null, 2)
}

function searchableText(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (value instanceof Error) return `${value.message} ${value.stack ?? ""}`
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function formatDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""))
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : ""
}

function formatTime(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""))
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString() : ""
}

function formatDuration(value: unknown) {
  const duration = Number(value)
  if (!Number.isFinite(duration)) return ""
  if (duration < 10) return `${duration.toFixed(1)} ms`
  return `${Math.round(duration)} ms`
}

function apiRequestToCurl(payload: Partial<ApiResponsePayload> = {}) {
  const output = []
  const request: ApiRequest = payload.request || {}
  const { method, headers, data, url } = request

  if (method === "GET") {
    output.push("curl")
  } else {
    output.push(`curl -X ${method || "GET"} `)
  }

  for (const header in headers) {
    output.push(` -H "${header}:${headers[header]}"`)
  }

  output.push(` ${url || ""}`)

  if (data) {
    output.push(` -d '${compactBody(data)}'`)
  }

  return output.join("")
}

function compactBody(value: unknown) {
  if (typeof value !== "string") return JSON.stringify(value)
  try {
    return JSON.stringify(JSON.parse(value))
  } catch {
    return value
  }
}

function countMatches(text: string, search: string) {
  const needle = search.trim().toLowerCase()
  if (!needle) return 0

  let count = 0
  let index = 0
  const haystack = text.toLowerCase()

  while ((index = haystack.indexOf(needle, index)) !== -1) {
    count++
    index += needle.length
  }

  return count
}

function renderCodeText(text: string, search: string) {
  const tokenPattern =
    /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\bnull\b|([{}[\],:])/g
  const nodes: ReactNode[] = []
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(
        renderSearchHighlightedText(text.slice(cursor, match.index), search, `plain-${cursor}`)
      )
    }

    const token = match[0]
    const key = `${match.index}-${token}`
    const content = renderSearchHighlightedText(token, search, key)

    if (match[1]) {
      nodes.push(<JsonKey key={key}>{content}</JsonKey>)
    } else if (match[2]) {
      nodes.push(<JsonString key={key}>{content}</JsonString>)
    } else if (match[3]) {
      nodes.push(<JsonNumber key={key}>{content}</JsonNumber>)
    } else if (match[4]) {
      nodes.push(<JsonBoolean key={key}>{content}</JsonBoolean>)
    } else if (token === "null") {
      nodes.push(<JsonNull key={key}>{content}</JsonNull>)
    } else {
      nodes.push(<JsonPunctuation key={key}>{content}</JsonPunctuation>)
    }

    cursor = match.index + token.length
  }

  if (cursor < text.length) {
    nodes.push(renderSearchHighlightedText(text.slice(cursor), search, `plain-${cursor}`))
  }

  return nodes
}

function renderSearchHighlightedText(text: string, search: string, keyPrefix: string): ReactNode {
  const needle = search.trim()
  if (!needle) return text

  const lowerText = text.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const parts: ReactNode[] = []
  let cursor = 0
  let matchIndex = lowerText.indexOf(lowerNeedle)

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      parts.push(text.slice(cursor, matchIndex))
    }

    const end = matchIndex + needle.length
    parts.push(
      <Highlight key={`${keyPrefix}-${matchIndex}-${end}`}>{text.slice(matchIndex, end)}</Highlight>
    )
    cursor = end
    matchIndex = lowerText.indexOf(lowerNeedle, cursor)
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor))
  }

  return parts
}

function filterJsonValue(value: unknown, search: string): unknown {
  const needle = search.trim().toLowerCase()
  if (!needle) return value

  const matchesPrimitive = (input: unknown) =>
    String(input ?? "")
      .toLowerCase()
      .includes(needle)

  if (Array.isArray(value)) {
    const filtered = value
      .map((item) => filterJsonValue(item, search))
      .filter((item) => item !== undefined)

    return filtered.length > 0 ? filtered : undefined
  }

  if (value && typeof value === "object") {
    const output = {}

    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      const filtered = filterJsonValue(item, search)
      if (key.toLowerCase().includes(needle) || filtered !== undefined) {
        output[key] = filtered === undefined ? item : filtered
      }
    })

    return Object.keys(output).length > 0 ? output : undefined
  }

  return matchesPrimitive(value) ? value : undefined
}

export default Network
