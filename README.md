# dsh-agent-desktop

Computer use for AI agents via OS accessibility trees — as a DeepSeek Harness plugin.

## What it does

Exposes [agent-desktop](https://github.com/vercel-labs/agent-desktop) capabilities as DSH tools:

| Tool | Description |
|------|-------------|
| **status** | Check platform, permissions, and supported surfaces |
| **snapshot** | Read accessibility tree of a window, returns JSON with element refs |
| **click** | Click an element by qualified ref |
| **type_text** | Type text into a text target (Windows: requires --headed) |
| **set_value** | Set element value directly via accessibility attribute |
| **screenshot** | Capture screenshot of window or full screen |
| **focus** | Focus an application window by name |
| **focus_element** | Set keyboard focus on element (Windows: requires --headed) |
| **find** | Search elements by role, name, value, or text content |
| **get** | Read element property (text, value, title, bounds, role, states) |
| **press** | Send key combo (return, escape, ctrl+c, etc.) |
| **wait** | Wait for element presence, text, or window appearance |
| **scroll** | Scroll element in a direction |
| **select** | Select an option in a list or dropdown |
| **list_windows** | List all visible windows |
| **launch** | Launch application and return once running |
| **clipboard_get** | Read plain-text clipboard contents |
| **clipboard_set** | Write text to the clipboard |

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

The native binary is auto-downloaded from GitHub Releases on first use and cached in `bin/`.

## Windows notes

- **type_text** and **focus_element** use physical delivery (`--headed`) on Windows. The CLI may report "Target element lost focus before physical input delivery" — this is a known Windows limitation. Use **set_value** as the reliable alternative for setting text.
- **screenshot** works with `--app` or `--window-id`.
- **focus-window** may fail with ACTION_FAILED when the target window cannot accept foreground focus.

## Permissions

Requires OS-level accessibility permissions:
- **macOS**: System Settings → Privacy & Security → Accessibility
- **Windows**: No special permission needed
- **Linux**: AT-SPI bus access

## License

Apache-2.0 (same as upstream agent-desktop)
