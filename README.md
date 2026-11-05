# dsh-agent-desktop

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE) [English](./README-en.md)

将 [agent-desktop](https://github.com/vercel-labs/agent-desktop) 的桌面自动化能力封装为 DeepSeek Harness（DSH）插件——通过操作系统辅助功能树（Accessibility Tree）实现 AI Agent 对桌面应用的可靠操作。

> **本项目基于 [vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop) v1.2.0 构建，原项目版权归 Vercel 及其贡献者所有，以 Apache License 2.0 协议开源。本插件作为桥接层同样遵循 Apache License 2.0。**

## 功能

插件在 DSH 中注册 `agent_desktop` 工具命名空间，共 **17 个工具**：

| 工具 | 说明 |
|------|------|
| `status` | 查询适配器健康状态、平台信息、权限状态 |
| `snapshot` | 读取窗口的可访问性树，返回带 `@ref` 引用的 JSON |
| `find` | 按 role / name / value / text 搜索元素 |
| `get` | 读取元素属性（text / value / title / bounds / role / states） |
| `click` | 通过可访问性动作点击元素 |
| `type_text` | 向文本目标输入文字（Windows 经剪贴板+Ctrl+V 投递） |
| `set_value` | 通过可访问性属性直接设置元素值 |
| `focus` | 将应用窗口置于前台 |
| `focus_element` | 为元素设置键盘焦点 |
| `press` | 发送按键组合（return / escape / ctrl+c 等） |
| `wait` | 等待元素出现、文本出现或窗口出现 |
| `scroll` | 滚动元素（方向 + 幅度） |
| `select` | 在列表或下拉框中选择选项 |
| `list_windows` | 列出所有可见窗口 |
| `launch` | 启动应用并等待进程就绪 |
| `clipboard_get` | 读取剪贴板纯文本 |
| `clipboard_set` | 写入文本到剪贴板 |

## 安装

### 前置要求

- [Node.js](https://nodejs.org) ≥ 18
- [DSH CLI](https://dsh.dev) 可用
- 网络可访问 GitHub Releases（首次安装自动下载原生二进制）

### 方式一：一条命令直接从 GitHub 安装

```bash
dsh plugin --profile desktop add github:hlee/dsh-agent-deskto
```

锁定版本（推荐，可复现）：

```bash
dsh plugin --profile desktop add git+https://github.com/hlee/dsh-agent-deskto.git#v1.2.0
```

### 方式二：先拉取、再从本地目录安装

```bash
git clone https://github.com/hlee/dsh-agent-deskto.git
dsh plugin --profile desktop add ./dsh-agent-deskto
```

安装时 `postinstall` 脚本会自动从 [GitHub Releases](https://github.com/vercel-labs/agent-desktop/releases) 下载对应平台的 `agent-desktop` 原生二进制到 `bin/` 并缓存；首次使用时若缺失也会自动补下载。

> **Bundle 层声明**：`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`（`insert: id=agent-desktop, name=dsh-agent-desktop`）。宿主加载 profile 时据此把插件写入 `dsh.profile.bundles` 层栈——缺少该声明时 `dsh plugin add` 只会装成普通依赖并警告 "declares no dsh.bundle"，工具不会挂载。

## 卸载

```bash
dsh plugin --profile desktop remove dsh-agent-desktop
```

或手动：

```bash
# 1. 从 profile 的 bundles 中移除
dsh plugin --profile desktop remove dsh-agent-desktop

# 2. 删除本地克隆目录（可选，按实际目录名）
rm -rf dsh-agent-deskto
```

## 各功能使用

所有工具由 DSH Agent 直接调用，命名空间为 `agent_desktop`。以下示例为各工具的参数与行为：

### status

查询平台与权限状态，无需参数。

```json
// 返回
{ "ok": true, "data": { "platform": "windows", "permissions": { "accessibility": { "state": "granted" } }, "version": "1.2.0" } }
```

### snapshot

读取窗口的可访问性树。**推荐始终传入 `windowId`**（来自 `list_windows`），避免前台窗口变化导致快照错位。

```json
{ "windowId": "w-197510" }
```

返回的树中每个可操作元素带 `ref_id`（如 `@s3mqlcadl5xc1g:e193`）和 `available_actions`。**后续所有元素操作都使用这个 ref**。ref 会随 UI 变化过期，操作前请取新鲜快照。

### find

按条件搜索元素，常用于快速定位 ref：

```json
{ "role": "button", "text": "确定" }
```

### get

读取元素属性：

```json
{ "ref": "@s3mqlcadl5xc1g:e23", "property": "text" }
```

### click

点击元素（语义投递，通过可访问性动作触发）：

```json
{ "ref": "@s3mqlcadl5xc1g:e11" }
```

### type_text

向文本目标输入文字：

```json
{ "ref": "@s3mqlcadl5xc1g:e193", "text": "你好，世界" }
```

> **Windows 投递机制**：Chromium/Electron 应用的 DOM 输入框会忽略 CLI 的 `SendInput` 物理投递（a11y value 不更新），且 `press` 仅支持命名键（`-`、`!` 等标点会报 INVALID_ARGS）。因此本工具在 Windows 上统一走 **focus → clipboard-set → press ctrl+v** 路径（已实测消息可上屏）；非 Windows 保持原生 `type --headed`。若系统开着中文输入法，逐字符按键可能被 IME 误转，剪贴板路径不受影响。

### set_value

通过 UI Automation 的 `ValuePattern.SetValue` 直接设置值，**不依赖物理焦点，是 Windows 上最可靠的写值方式**：

```json
{ "ref": "@s3mqlcadl5xc1g:e23", "value": "搜索内容" }
```

### focus（窗口级）

将应用窗口置于前台：

```json
{ "app": "DeepSeek Harness" }
```

### focus_element（元素级）

为元素设置键盘焦点（Windows 使用 `--headed` 物理投递）：

```json
{ "ref": "@s3mqlcadl5xc1g:e193" }
```

### press

发送按键组合。可用键：`return` `escape` `tab` `space` `delete` `up` `down` `left` `right` `f1-f12`；修饰键：`ctrl` `alt` `shift`：

```json
{ "key": "ctrl+v" }
```

### wait

等待元素或文本出现（默认超时 30 秒）：

```json
{ "element": "@s3mqlcadl5xc1g:e9", "timeout": 5000 }
```

### scroll

滚动元素。目标必须暴露滚动动作（如对话列表、文档容器）：

```json
{ "ref": "@s3mqlcadl5xc1g:e283", "direction": "down", "amount": 1 }
```

> 目标元素需在快照的 `available_actions` 中包含 `Scroll`，否则返回 `ACTION_NOT_SUPPORTED`。

### select

在列表或下拉框中选择：

```json
{ "ref": "@s3mqlcadl5xc1g:e297", "value": "选项文本" }
```

### list_windows

列出所有可见窗口（可按应用名过滤），用于获取 `snapshot` 需要的 `windowId`：

```json
{ "app": "DeepSeek Harness" }
```

### launch

启动应用：

```json
{ "app": "notepad", "activate": true }
```

### clipboard_get / clipboard_set

读写剪贴板纯文本：

```json
// clipboard_set
{ "text": "要复制的文本" }

// clipboard_get
{}
```

## 典型工作流

DSH Agent 操作桌面应用的标准循环：

```
list_windows → snapshot(--window-id) → find/get（定位元素）
    → click / set_value / type_text（操作元素）→ snapshot（验证结果）
```

## 精简说明

- **本质**：`child_process.spawn` 调用 agent-desktop Rust CLI，CLI 通过 OS 可访问性 API（Windows UI Automation / macOS AX / Linux AT-SPI）读取和操作界面，全程不依赖截图与像素匹配。
- **ref 生命周期**：`snapshot` 返回的 `@ref` 绑定当次快照，UI 变化即失效（STALE_REF / AMBIGUOUS_TARGET），操作前重新 snapshot 即可。
- **投递方式**：语义投递（可访问性 API，无头默认）与物理投递（`--headed`，真实鼠标键盘事件）两种；插件在 Windows 上为 `type_text` / `focus_element` 自动附加 `--headed`。
- **失败可重试性**：所有错误响应带 `disposition.retry` 字段，`"safe"` 表示可直接重试，`"unsafe"` 表示需先重新观察。
- **平台支持**：Windows x64 / macOS arm64 & x64 / Linux x64；原生二进制约 10 MB，安装时自动下载。
- **权限**：插件声明 `subprocess`（调用 CLI）与 `filesystem-read`（读取二进制）两项权限；macOS 需在系统设置中授予辅助功能权限。

## 与原项目的差异

本插件是**桥接层**，未修改 agent-desktop 任何代码。原项目 CLI 共 65 个命令，本插件覆盖其中 17 个核心工具（计算机使用主循环 100% 覆盖）。未桥接的命令（物理鼠标操作、窗口尺寸调整、通知管理等边缘场景）仍可通过 `dsh_bash` 直接调用 CLI 使用。

## License

Apache-2.0。原项目 [agent-desktop](https://github.com/vercel-labs/agent-desktop) 版权归 Vercel 及其贡献者所有。