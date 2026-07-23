# React Native Debugger — remaining work

## Completed checkpoint

- [x] Native source explorer, full file filtering, on-demand source text, source-map breakpoint mapping, Hermes connection, pause/resume, and reload-safe Metro platform fallback.
- [x] Checkpoint pushed: `81de10c6`.

## Wave 1 — foundations in progress

- [ ] Editor ergonomics: find within the open file, match navigation, visible match highlighting, and syntax color coding.
- [ ] Hermes CDP session: retain paused call frames, scopes and remote object handles; add step over/into/out, exception pause policy, reconnect, and logical breakpoint restoration.

## Wave 2 — debugger experience

- [ ] Paused source line focus/highlight and execution toolbar.
- [ ] Call stack panel with frame selection.
- [ ] Scope/local/closure inspector with expandable remote objects.
- [ ] Watch expressions evaluated in the selected paused frame.
- [ ] Conditional breakpoints and logpoints.

## Acceptance checks

- A breakpoint pauses on the correct original source line after a Metro reload or Fast Refresh and is restored after reconnect.
- Developers can step execution and inspect call frames, local values, closures, and expanded object values without opening Chrome DevTools.
- File filtering, in-file search, and syntax color coding remain responsive for large Metro source maps.
- Logs and network remain in their existing Reactotron tabs, not in Debugger.
