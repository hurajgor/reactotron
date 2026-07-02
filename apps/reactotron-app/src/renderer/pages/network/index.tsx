import React, { ReactNode, useContext, useMemo, useState } from "react"
import { clipboard } from "electron"
import {
  MdContentCopy,
  MdDeleteSweep,
  MdInsertDriveFile,
  MdNetworkCheck,
  MdSearch,
} from "react-icons/md"
import styled from "styled-components"
import {
  ContentView,
  EmptyState,
  Header,
  ReactotronContext,
} from "reactotron-core-ui"
import type { ApiResponsePayload, Command, LogPayload } from "reactotron-core-contract"

type ConsoleKind = "network" | "log"
type BodyMode = "pretty" | "tree" | "raw"
type InspectorTab = "summary" | "request" | "response" | "headers" | "raw"
type LogLevelFilter = "all" | "debug" | "warn" | "error"

type ConsoleItem = {
  id: string
  kind: ConsoleKind
  command: Command
  title: string
  subtitle: string
  method: string
  status: string
  tone: "good" | "warn" | "bad" | "muted" | "redirect"
  time: string
  duration?: number
}

type ApiRequest = Partial<ApiResponsePayload["request"]>
type ApiResponse = Partial<ApiResponsePayload["response"]>

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
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.backgroundSubtleDark};
`

const SearchBox = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 220px;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 4px;
  background-color: ${(props) => props.theme.background};
  color: ${(props) => props.theme.foregroundDark};
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
  gap: 6px;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 4px;
  color: ${(props) => props.theme.foreground};
  background-color: ${(props) => props.theme.background};
  font-size: 12px;
  cursor: pointer;

  input {
    margin: 0;
    accent-color: ${(props) => props.theme.highlight};
  }
`

const SelectControl = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 4px;
  color: ${(props) => props.theme.foreground};
  background-color: ${(props) => props.theme.background};
  font-size: 12px;
`

const Select = styled.select`
  border: 0;
  outline: 0;
  background: transparent;
  color: ${(props) => props.theme.foreground};
  font-size: 12px;
`

const Workspace = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: minmax(360px, 1fr) minmax(420px, 560px);
  min-height: 0;
  overflow: hidden;
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

const TableHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 1;
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr) 92px 84px;
  gap: 12px;
  padding: 9px 14px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.backgroundSubtleDark};
  color: ${(props) => props.theme.foregroundDark};
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
`

const EventRow = styled.button<{ $selected: boolean; $tone: ConsoleItem["tone"] }>`
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr) 92px 84px;
  gap: 12px;
  width: 100%;
  min-height: 54px;
  padding: 9px 14px;
  border: 0;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  border-left: 3px solid ${(props) => toneColor(props.$tone)};
  outline: 0;
  background-color: ${(props) =>
    props.$selected ? props.theme.backgroundHighlight : "transparent"};
  color: ${(props) => props.theme.foreground};
  text-align: left;
  cursor: pointer;

  &:hover {
    background-color: ${(props) => props.theme.backgroundHighlight};
  }
`

const Method = styled.strong<{ $kind: ConsoleKind }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: ${(props) => (props.$kind === "network" ? props.theme.bold : props.theme.tag)};
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

const Status = styled.i<{ $tone: ConsoleItem["tone"] }>`
  align-self: center;
  justify-self: start;
  padding: 3px 7px;
  border-radius: 999px;
  color: ${(props) => toneColor(props.$tone)};
  background-color: rgba(255, 255, 255, 0.05);
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
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
  background-color: ${(props) => props.theme.background};
`

const InspectorHeader = styled.div`
  padding: 14px 16px 12px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
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

const ActionBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.backgroundSubtleDark};
`

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 4px;
  background-color: ${(props) => props.theme.background};
  color: ${(props) => props.theme.foreground};
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: ${(props) => props.theme.foregroundDark};
    background-color: ${(props) => props.theme.backgroundHighlight};
  }
`

const Tabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 10px 16px 0;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
`

const TabButton = styled.button<{ $active: boolean }>`
  padding: 8px 10px;
  border: 0;
  border-bottom: 2px solid
    ${(props) => (props.$active ? props.theme.highlight : "transparent")};
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
  border-radius: 4px;
  overflow: hidden;
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
  border-radius: 4px;
  overflow: hidden;
`

const ViewerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.backgroundSubtleDark};
`

const ViewerTools = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

const ViewerModes = styled.div`
  display: flex;
  gap: 4px;
`

const ViewerSearch = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 190px;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 3px;
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
  padding: 4px 8px;
  border: 1px solid ${(props) => (props.$active ? props.theme.highlight : props.theme.chromeLine)};
  border-radius: 3px;
  background-color: ${(props) => (props.$active ? props.theme.backgroundHighlight : props.theme.background)};
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

const Highlight = styled.mark`
  padding: 0;
  color: inherit;
  background-color: rgba(232, 168, 56, 0.45);
`

const TreeBody = styled.div`
  min-height: 180px;
  max-height: 520px;
  overflow: auto;
  padding: 12px;
  background-color: ${(props) => props.theme.backgroundSubtleDark};
`

const ArgumentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
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

function Network() {
  const { clearCommands, commands } = useContext(ReactotronContext)
  const [query, setQuery] = useState("")
  const [showNetwork, setShowNetwork] = useState(true)
  const [showLogs, setShowLogs] = useState(true)
  const [logLevel, setLogLevel] = useState<LogLevelFilter>("all")
  const [selectedId, setSelectedId] = useState<string>("")

  const items = useMemo(() => buildItems(commands), [commands])
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items
      .filter((item) => (item.kind === "network" ? showNetwork : showLogs))
      .filter((item) => item.kind !== "log" || logLevel === "all" || item.status === logLevel)
      .filter((item) => {
        if (!needle) return true
        return `${item.method} ${item.title} ${item.subtitle} ${item.status}`.toLowerCase().includes(needle)
      })
  }, [items, logLevel, query, showLogs, showNetwork])

  const selectedItem =
    visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0] ?? null

  return (
    <Container>
      <Header title="Network" isDraggable />
      <Toolbar>
        <SearchBox>
          <MdSearch size={16} />
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search endpoints, logs, status, hosts"
          />
        </SearchBox>
        <Toggle>
          <input
            type="checkbox"
            checked={showNetwork}
            onChange={(event) => setShowNetwork(event.target.checked)}
          />
          Network
        </Toggle>
        <Toggle>
          <input
            type="checkbox"
            checked={showLogs}
            onChange={(event) => setShowLogs(event.target.checked)}
          />
          Logs
        </Toggle>
        <SelectControl>
          Log level
          <Select
            value={logLevel}
            onChange={(event) => setLogLevel(event.target.value as LogLevelFilter)}
          >
            <option value="all">All</option>
            <option value="debug">Log & debug</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </Select>
        </SelectControl>
        <ActionButton
          type="button"
          onClick={() => {
            clearCommands()
            setSelectedId("")
          }}
        >
          <MdDeleteSweep size={14} />
          Clear
        </ActionButton>
      </Toolbar>
      <Workspace>
        <EventTable>
          <TableHeader>
            <span>Kind</span>
            <span>Endpoint / log</span>
            <span>Status</span>
            <span>Time</span>
          </TableHeader>
          {visibleItems.length === 0 ? (
            <EmptyTableState>
              <EmptyState icon={MdNetworkCheck} title="No Network Activity">
                Network requests and logs will appear here once your app connects on the active
                Reactotron port.
              </EmptyState>
            </EmptyTableState>
          ) : (
            visibleItems.map((item) => (
              <EventRow
                key={item.id}
                type="button"
                $selected={selectedItem?.id === item.id}
                $tone={item.tone}
                onClick={() => setSelectedId(item.id)}
              >
                <Method $kind={item.kind}>
                  {item.kind === "network" ? <MdNetworkCheck size={14} /> : <MdInsertDriveFile size={14} />}
                  {item.method}
                </Method>
                <EventTitle>
                  <b>{item.title}</b>
                  <small>{item.subtitle}</small>
                </EventTitle>
                <Status $tone={item.tone}>{item.status}</Status>
                <Time>{item.time}</Time>
              </EventRow>
            ))
          )}
        </EventTable>
        <Inspector>
          {selectedItem ? (
            <ConsoleInspector item={selectedItem} />
          ) : (
            <EmptyState icon={MdNetworkCheck} title="Select An Event">
              Choose a request or log to inspect its details.
            </EmptyState>
          )}
        </Inspector>
      </Workspace>
    </Container>
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

  return (
    <>
      <InspectorHeader>
        <InspectorEyebrow>Network request</InspectorEyebrow>
        <InspectorTitle>
          <strong title={request.url}>{item.title}</strong>
          <Status $tone={item.tone}>{item.status}</Status>
        </InspectorTitle>
      </InspectorHeader>
      <ActionBar>
        <CopyButton text={formatBody(response.body)}>Copy response</CopyButton>
        <CopyButton text={formatBody(request.data)}>Copy request</CopyButton>
        <CopyButton text={apiRequestToCurl(payload)}>Copy cURL</CopyButton>
        <CopyButton text={JSON.stringify(item.command, null, 2)}>Copy event</CopyButton>
      </ActionBar>
      <Tabs>
        {(["summary", "request", "response", "headers", "raw"] as InspectorTab[]).map((value) => (
          <TabButton key={value} type="button" $active={tab === value} onClick={() => setTab(value)}>
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
  const args = normalizeLogArgs(payload.message).map(normalizeLogArgument)

  return (
    <>
      <InspectorHeader>
        <InspectorEyebrow>Log event</InspectorEyebrow>
        <InspectorTitle>
          <strong>{item.title}</strong>
          <Status $tone={item.tone}>{item.status}</Status>
        </InspectorTitle>
      </InspectorHeader>
      <ActionBar>
        <CopyButton text={formatLogForCopy(args)}>Copy log</CopyButton>
        <CopyButton text={JSON.stringify(item.command, null, 2)}>Copy event</CopyButton>
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
            <Section>
              <SectionTitle>Summary</SectionTitle>
              <FieldTable
                rows={[
                  ["Level", payload.level],
                  ["Arguments", args.length],
                  ["Time", formatDate(item.command.date)],
                  ["Message ID", item.command.messageId],
                ]}
              />
            </Section>
            {args.length > 1 ? (
              <LogArguments args={args} />
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
}

function LogArguments({ args }: { args: LogArgument[] }) {
  return (
    <Section>
      <SectionTitle>Arguments</SectionTitle>
      <ArgumentList>
        {args.map((arg, index) => (
          <div key={index}>
            <ArgumentHeader>
              <ArgumentBadge>arg {index + 1}</ArgumentBadge>
              <span>{argumentTypeLabel(arg)}</span>
            </ArgumentHeader>
            <PayloadViewer label="" value={arg.value} />
          </div>
        ))}
      </ArgumentList>
    </Section>
  )
}

function PayloadViewer({ label, value }: { label: string; value: unknown }) {
  const [mode, setMode] = useState<BodyMode>("pretty")
  const [search, setSearch] = useState("")
  const parsed = parseBody(value)
  const prettyText = formatBody(value)
  const rawText = typeof value === "string" ? value : JSON.stringify(value, null, 2)
  const canTree = parsed !== undefined && parsed !== null && typeof parsed === "object"
  const visibleText = mode === "raw" ? rawText : prettyText
  const matchCount = countMatches(visibleText, search)
  const treeValue = search && canTree ? filterJsonValue(parsed, search) : parsed

  return (
    <Section>
      {label ? <SectionTitle>{label}</SectionTitle> : null}
      <ViewerContainer>
        <ViewerHeader>
          <ViewerTools>
            <ViewerModes>
              <ModeButton type="button" $active={mode === "pretty"} onClick={() => setMode("pretty")}>
                Pretty
              </ModeButton>
              <ModeButton type="button" $active={mode === "tree"} onClick={() => setMode("tree")} disabled={!canTree}>
                Tree
              </ModeButton>
              <ModeButton type="button" $active={mode === "raw"} onClick={() => setMode("raw")}>
                Raw
              </ModeButton>
            </ViewerModes>
            <ViewerSearch>
              <MdSearch size={13} />
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
            <ContentView value={treeValue} treeLevel={search ? 8 : 1} copyToClipboard={clipboard.writeText} />
          </TreeBody>
        ) : (
          <CodeBlock>{highlightText(visibleText, search)}</CodeBlock>
        )}
      </ViewerContainer>
    </Section>
  )
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
      <MdContentCopy size={14} />
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
    .map((command) => command.type === "api.response"
      ? networkItem(command)
      : logItem(command))
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
    method: String(request.method ?? "HTTP").toUpperCase(),
    status: status == null ? "pending" : String(status),
    tone: toneForStatus(status),
    time: payload.duration != null ? `${payload.duration} ms` : formatTime(command.date),
    duration: payload.duration,
  }
}

function logItem(command: Command): ConsoleItem {
  const payload = command.payload as LogPayload
  const level = payload?.level ?? "log"
  const message = payload?.message

  return {
    id: String(command.messageId),
    kind: "log",
    command,
    title: formatLogPreview(message),
    subtitle: formatDate(command.date),
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

function normalizeLogLevel(level: unknown): LogLevelFilter {
  const text = String(level ?? "").toLowerCase()
  if (text === "error") return "error"
  if (text === "warn" || text === "warning") return "warn"
  return "debug"
}

function displayLogLevel(level: unknown) {
  const normalized = normalizeLogLevel(level)
  if (normalized === "debug") return "LOG"
  if (normalized === "warn") return "WARN"
  return "ERROR"
}

function normalizeLogArgs(message: unknown) {
  const value = unwrapSerializedLogMessage(message)
  return Array.isArray(value) ? value : [value]
}

function normalizeLogArgument(value: unknown): LogArgument {
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

function argumentTypeLabel(arg: LogArgument) {
  if (arg.parsedFromString) return "JSON string parsed for viewing"
  if (Array.isArray(arg.value)) return "array"
  if (arg.value === null) return "null"
  return typeof arg.value
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
  const args = normalizeLogArgs(message)

  return args
    .map((arg) => {
      const normalizedArg = normalizeLogArgument(arg).value
      if (typeof normalizedArg === "string") return normalizedArg
      if (normalizedArg instanceof Error) return normalizedArg.message
      if (typeof arg === "string") return arg
      if (arg instanceof Error) return arg.message
      try {
        return JSON.stringify(normalizedArg)
      } catch {
        return String(normalizedArg)
      }
    })
    .join(" ")
    .slice(0, 500)
}

function toneColor(tone: ConsoleItem["tone"]) {
  switch (tone) {
    case "good":
      return "#50c878"
    case "warn":
      return "#e8a838"
    case "bad":
      return "#ff6b6b"
    case "redirect":
      return "#74c0fc"
    default:
      return "#838184"
  }
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

function formatDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""))
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : ""
}

function formatTime(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""))
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString() : ""
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

function highlightText(text: string, search: string) {
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
    parts.push(<Highlight key={`${matchIndex}-${end}`}>{text.slice(matchIndex, end)}</Highlight>)
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

  const matchesPrimitive = (input: unknown) => String(input ?? "").toLowerCase().includes(needle)

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
