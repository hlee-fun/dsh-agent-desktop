# dsh-agent-desktop

**[简体中文](./README.md)** | English

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

Desktop automation for AI agents as a DeepSeek Harness (DSH) plugin, powered by [agent-desktop](https://github.com/vercel-labs/agent-desktop) — reliable operation of desktop apps through OS accessibility trees.

> **Built on [vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop) v1.2.0. The upstream project is copyright Vercel and its contributors, licensed under Apache License 2.0. This bridge plugin follows the same Apache License 2.0.**

## Features

The plugin registers an `agent_desktop` tool namespace in DSH with **17 tools**:

| Tool | Description |
|------|-------------|
| `status` | Adapter health, platform info, permission state |
| `snapshot` | Read a window's accessibility tree; returns JSON with `@ref` handles |
| `find` | Search elements by role / name / value / text |
| `get` | Read an element property (text / value / title / bounds / role / states) |
| `click` | Click an element via its accessibility action |
| `type_text` | Type text into a target (Windows: delivered via clipboard + Ctrl+V) |
| `set_value` | Set an element value directly through the accessibility attribute |
| `focus` | Bring an application window to the foreground |
| `focus_element` | Set keyboard focus on an element |
| `press` | Send a key combo (return / escape / ctrl+c / ...) |
| `wait` | Wait for an element, text, or window to appear |
| `scroll` | Scroll an element (direction + amount) |
| `select` | Select an option in a list or dropdown |
| `list_windows` | List all visible windows |
| `launch` | Launch an application and wait for its process |
| `clipboard_get` | Read plain-text clipboard contents |
| `clipboard_set` | Write text to the clipboard |

## Install

### Prerequisites

- DSH desktop app installed (it ships its own CLI and Node runtime — **no separate Node.js / npm install needed**)
- Network access to GitHub (for the plugin itself and the first native-binary download)

> **Invoking the DSH CLI**: `dsh` is not on the system PATH; it lives inside the app at
> `<DSH install dir>/resources/runtime/cli/bin/` (`dsh.cmd` on Windows, `dsh` on macOS/Linux).
> Add that directory to your PATH, or replace `dsh` in the examples below with the full path on your machine — **the install location differs per machine; never copy an absolute path verbatim**.

### Option 1: one command, straight from GitHub

```bash
dsh plugin --profile desktop add github:hlee/dsh-agent-deskto
```

Pinned to a tag (recommended, reproducible):

```bash
dsh plugin --profile desktop add git+https://github.com/hlee/dsh-agent-deskto.git#v1.2.0
```

### Option 2: clone first, then install from the local directory

```bash
git clone https://github.com/hlee/dsh-agent-deskto.git
dsh plugin --profile desktop add ./dsh-agent-deskto
```

On install, the `postinstall` script downloads the platform-matched `agent-desktop` native binary from [GitHub Releases](https://github.com/vercel-labs/agent-desktop/releases) into `bin/` and caches it; if it is missing at first use, it is fetched automatically.

> **Bundle-layer declaration**: `package.json` declares `dsh.bundle.patch` pointing to `cordis.patch.yml` (`insert: id=agent-desktop, name=dsh-agent-desktop`). The host uses this to place the plugin into the `dsh.profile.bundles` layer stack. Without the declaration, `dsh plugin add` installs it as a plain dependency with a "declares no dsh.bundle" warning and the tools never mount.

## Uninstall

```bash
dsh plugin --profile desktop remove dsh-agent-desktop
```

Or manually:

```bash
# 1. remove from the profile bundles
dsh plugin --profile desktop remove dsh-agent-desktop

# 2. delete the cloned directory (optional; adjust to the actual directory name)
rm -rf dsh-agent-deskto
```

## Usage

All tools are invoked by the DSH agent under the `agent_desktop` namespace. Parameter examples:

### status

No parameters. Returns platform, permissions and version:

```json
{ "ok": true, "data": { "platform": "windows", "permissions": { "accessibility": { "state": "granted" } }, "version": "1.2.0" } }
```

### snapshot

Reads the accessibility tree. **Always pass `windowId`** (from `list_windows`) to avoid capturing the wrong foreground window:

```json
{ "windowId": "w-197510" }
```

Every actionable element carries a `ref_id` (e.g. `@s3mqlcadl5xc1g:e193`) and `available_actions`. All later element actions use this ref. Refs expire when the UI changes — take a fresh snapshot before acting.

### find

```json
{ "role": "button", "text": "OK" }
```

### get

```json
{ "ref": "@s3mqlcadl5xc1g:e23", "property": "text" }
```

### click

Semantic delivery via the element's accessibility action:

```json
{ "ref": "@s3mqlcadl5xc1g:e11" }
```

### type_text

```json
{ "ref": "@s3mqlcadl5xc1g:e193", "text": "hello world" }
```

> **Windows delivery**: Chromium/Electron DOM inputs ignore the CLI's `SendInput` physical typing (the a11y value never updates), and `press` only accepts named keys (punctuation like `-` or `!` returns INVALID_ARGS). On Windows this tool therefore uses **focus → clipboard-set → press ctrl+v** uniformly (verified end-to-end: messages really send). Non-Windows keeps native `type --headed`. A live CJK IME can garble per-character keystrokes; the clipboard path is immune.

### set_value

Direct `ValuePattern.SetValue` — no physical focus needed; the most reliable way to write values on Windows:

```json
{ "ref": "@s3mqlcadl5xc1g:e23", "value": "search text" }
```

### focus (window-level)

```json
{ "app": "DeepSeek Harness" }
```

### focus_element (element-level)

Uses `--headed` physical delivery on Windows:

```json
{ "ref": "@s3mqlcadl5xc1g:e193" }
```

### press

Named keys: `return` `escape` `tab` `space` `delete` `up` `down` `left` `right` `f1`-`f12`; modifiers: `ctrl` `alt` `shift`:

```json
{ "key": "ctrl+v" }
```

### wait

Default timeout 30 s:

```json
{ "element": "@s3mqlcadl5xc1g:e9", "timeout": 5000 }
```

### scroll

The target must expose the Scroll action (list/document containers do; buttons don't):

```json
{ "ref": "@s3mqlcadl5xc1g:e283", "direction": "down", "amount": 1 }
```

Otherwise returns `ACTION_NOT_SUPPORTED`.

### select

```json
{ "ref": "@s3mqlcadl5xc1g:e297", "value": "option text" }
```

### list_windows

Use this to obtain the `windowId` for `snapshot`. Note: DSH may expose several windows; the main window is the large one (filter by bounds):

```json
{ "app": "DeepSeek Harness" }
```

### launch

```json
{ "app": "notepad", "activate": true }
```

### clipboard_get / clipboard_set

```json
// clipboard_set
{ "text": "text to copy" }

// clipboard_get
{}
```

## Typical Workflow

```
list_windows → snapshot(--window-id) → find/get (locate elements)
    → click / set_value / type_text (act) → snapshot (verify)
```

## Notes

- **Architecture**: `child_process.spawn` into the agent-desktop Rust CLI, which reads and drives the UI through OS accessibility APIs (Windows UI Automation / macOS AX / Linux AT-SPI). No screenshots, no pixel matching.
- **Ref lifecycle**: `@ref` handles belong to one snapshot and expire on UI changes (STALE_REF / AMBIGUOUS_TARGET). Re-snapshot before acting.
- **Delivery modes**: semantic (accessibility APIs, headless default) vs physical (`--headed`, real pointer/keyboard events). The plugin auto-adds `--headed` where Windows requires it.
- **Retry semantics**: every error carries `disposition.retry` — `"safe"` means retry as-is, `"unsafe"` means observe again first.
- **Platforms**: Windows x64 / macOS arm64 & x64 / Linux x64; the native binary (~10 MB) is downloaded automatically.
- **Permissions**: the plugin declares `subprocess` (CLI invocation) and `filesystem-read` (binary read). macOS additionally needs Accessibility permission in System Settings.

## Differences from the Upstream Project

This plugin is a **bridge layer**; no agent-desktop code is modified. The upstream CLI has 65 commands; the plugin covers 17 core tools (100% of the computer-use main loop). Ungbridged commands (physical mouse operations, window resizing, notifications, etc.) remain callable directly via the CLI.

## License

Apache-2.0. Upstream [agent-desktop](https://github.com/vercel-labs/agent-desktop) is copyright Vercel and its contributors.