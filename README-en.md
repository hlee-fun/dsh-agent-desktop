# dsh-agent-desktop

[简体中文](./README.md) | **English**

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey) ![Release](https://img.shields.io/badge/release-v1.2.2-green)

DeepSeek Harness (DSH) plugin giving AI agents computer-use capabilities. Reads and operates desktop applications through OS accessibility trees (Windows UI Automation / macOS AX / Linux AT-SPI) — no screenshots, no pixel matching.

## Features

- Registers the `agent_desktop` tool namespace with **17 tools**
- Covers the computer-use loop: **observe** (snapshot / find / get) → **act** (click / type_text / set_value / press / scroll / select / focus) → **verify** (screenshot / snapshot)
- Native binary fetched automatically on first tool call, then cached
- Structured errors (`error.code` + `disposition.retry`) so agents can retry safely
- This plugin bridges the core subset; the full capability set (65 commands: physical mouse, window management, notifications, batching, ...) lives in the upstream [agent-desktop](https://github.com/vercel-labs/agent-desktop)

## Requirements

| Platform | Architecture |
|----------|--------------|
| Windows | x64 |
| macOS | arm64 / x64 |
| Linux | x64 |

- DSH desktop app installed (it ships its own CLI and Node runtime — **no separate Node.js / npm needed**)
- Network access to GitHub (plugin install + first native-binary download)

## Install


**Option 1: one command from GitHub**

web profile:

```bash
dsh plugin --profile web add hlee-fun/dsh-agent-desktop
dsh plugin --profile web add github:hlee-fun/dsh-agent-desktop
```

desktop profile:

```bash
dsh plugin --profile desktop add hlee-fun/dsh-agent-desktop
dsh plugin --profile desktop add github:hlee-fun/dsh-agent-desktop
```

**Option 2: clone, then install from the local directory**

```bash
git clone https://github.com/hlee-fun/dsh-agent-desktop.git
dsh plugin --profile desktop add ./dsh-agent-desktop
```

**Restart the DSH app** after installing for the plugin layer to take effect.

## Quick Start

The standard agent loop for operating a desktop app:

```
list_windows → snapshot(windowId) → find / get (locate elements)
    → click / type_text / set_value / press (act)
    → snapshot / screenshot (verify)
```

## Tool Reference

| Tool | Parameters | Description |
|------|------------|-------------|
| `status` | — | Platform, permissions, adapter health |
| `snapshot` | `app?` `windowId?` `depth?` | Read a window's accessibility tree; returns JSON with `@ref` handles |
| `find` | `role?` `name?` `value?` `text?` | Search elements by criteria |
| `get` | `ref` `property?` | Read an element property (text/value/title/bounds/role/states) |
| `click` | `ref` | Click an element via its accessibility action |
| `type_text` | `ref` `text` | Type into a text target (Windows: delivered via clipboard automatically) |
| `set_value` | `ref` `value` | Set an element value directly through the accessibility attribute |
| `press` | `key` | Key combos: `return` `escape` `tab` `space` `delete` arrows `f1-f12`; modifiers `ctrl/alt/shift` |
| `wait` | `element?` `text?` `window?` `timeout?` | Wait for an element / text / window (default 30 s) |
| `scroll` | `ref` `direction?` `amount?` | Scroll (target must support the Scroll action) |
| `select` | `ref` `value` | Select an option in a list or dropdown |
| `focus` | `app` | Bring an application window to the foreground |
| `focus_element` | `ref` | Set keyboard focus on an element |
| `screenshot` | `app?` `windowId?` `region?` | Capture a screenshot; returns base64 PNG |
| `list_windows` | `app?` | List visible windows (source of `windowId`) |
| `launch` | `app?` `activate?` | Launch an application |
| `clipboard_get` | — | Read plain-text clipboard contents |
| `clipboard_set` | `text` | Write text to the clipboard |

**Ref rules**: `snapshot` yields handles shaped `@<snapshot_id>:eN` used by all element actions. Handles expire when the UI changes (`STALE_REF` / `AMBIGUOUS_TARGET`) — re-snapshot before acting.

**Examples**:

```json
// snapshot: always pass windowId (from list_windows; pick the main window — the one with large bounds)
{ "windowId": "w-197510" }

// type_text: write into the chat input
{ "ref": "@s3mqlcadl5xc1g:e193", "text": "hello world" }

// press: send with Enter
{ "key": "return" }

// scroll: one unit down (target available_actions must include Scroll)
{ "ref": "@s3mqlcadl5xc1g:e283", "direction": "down", "amount": 1 }
```

## Troubleshooting

| Symptom | Cause and fix |
|---------|----------------|
| `type_text` returns `POLICY_DENIED` or text does not land | On Windows, Chromium/Electron inputs ignore physical keystroke delivery; this plugin automatically delivers via **clipboard + Ctrl+V** (verified end-to-end). If it still fails, use `set_value` |
| `WINDOW_NOT_FOUND` | No focused window: call `list_windows`, take the large-bounds main window, pass `windowId` to `snapshot` |
| `ACTION_NOT_SUPPORTED` (scroll/select) | Target element lacks the action: pick a container whose `available_actions` include `Scroll` / `Select` |
| Keystrokes swallowed by a popup | DSH global shortcuts (e.g. Ctrl+A) open a search overlay that steals focus: `press` `escape` first |
| Install warns `declares no dsh.bundle` | `package.json` lost its `dsh.bundle` declaration, so the plugin will not mount. Shipped here via `cordis.patch.yml` — keep it when forking |
| macOS permission missing | System Settings → Privacy & Security → Accessibility, grant and retry |

## Uninstall

```bash
dsh plugin --profile desktop remove dsh-agent-desktop
```

Fully clean local leftovers (PowerShell; "Administrator" is this machine's user folder — replace with your username or use the $env:USERPROFILE form):

```powershell
Remove-Item -Force C:\Users\Administrator\.dsh\profiles\desktop\node_modules\dsh-agent-desktop
Remove-Item -Recurse -Force C:\Users\Administrator\.agent-desktop
```

## Upstream & License

This project is a **bridge layer**; no upstream code is modified. Built on [vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop) v1.2.0 (Apache-2.0), copyright Vercel and its contributors; this plugin is likewise released under [Apache-2.0](./LICENSE).

The upstream CLI offers 65 commands; this plugin bridges the 17 core tools (full coverage of the computer-use loop). Ungbridged commands (physical mouse, window sizing, notifications, ...) remain available by invoking the CLI directly.