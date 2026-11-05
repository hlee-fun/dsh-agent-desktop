# dsh-agent-desktop

Computer use for AI agents via OS accessibility trees — as a DeepSeek Harness plugin.

## What it does

Exposes [agent-desktop](https://github.com/vercel-labs/agent-desktop) capabilities as DSH tools:

- **snapshot** — Read the accessibility tree of the active window, returns JSON with element refs
- **click** — Click an element by ref
- **type_text** — Type text into an element by ref
- **screenshot** — Capture a screenshot
- **focus** — Focus an application window
- **status** — Check platform, permissions, and supported surfaces

## Install

```bash
npm install dsh-agent-desktop
dsh plugin --profile desktop add file:./dsh-agent-desktop
```

## Platform support

| Platform | Architecture | Status |
|----------|-------------|--------|
| macOS    | arm64, x64  | ✅     |
| Windows  | x64         | ✅     |
| Linux    | x64         | ✅     |

## How it works

The plugin wraps the agent-desktop Rust CLI via `child_process.spawn`. The CLI reads the OS accessibility tree (macOS AX, Windows UI Automation, Linux AT-SPI) and returns JSON with refs that the DSH agent can act on.

## Permissions

Requires OS-level accessibility permissions:
- **macOS**: System Settings → Privacy & Security → Accessibility
- **Windows**: No special permission needed
- **Linux**: AT-SPI bus access

## License

Apache-2.0 (same as upstream agent-desktop)
