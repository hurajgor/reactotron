# Reactotron Agent CLI

The Reactotron Agent CLI gives developers and coding agents a scriptable interface to the Reactotron desktop app. It uses the same local MCP boundary as other agent clients, so Reactotron's redaction settings remain enforced.

```bash
npx @hurajgor/reactotron-cli agent status --json
npx @hurajgor/reactotron-cli agent timeline --type api.response --limit 20 --json
npx @hurajgor/reactotron-cli agent ui press --test-id submit-button --json
```

Open Reactotron, connect the app, and enable **MCP** in the footer before using the CLI. The CLI discovers release port `4567` and development port `4568`; use `--port` or `--url` to override discovery.

Run `reactotron agent --help` for the complete command list.
