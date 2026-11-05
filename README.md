# dsh-agent-desktop

**中文** | [English](./README-en.md)

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey) ![Release](https://img.shields.io/badge/release-v1.2.0-green)

DeepSeek Harness（DSH）插件：为 AI Agent 提供计算机操作能力。基于操作系统无障碍树（Windows UI Automation / macOS AX / Linux AT-SPI）读取并操作桌面应用，不依赖截图与像素识别。

## 特性

- 注册 `agent_desktop` 工具命名空间，共 **17 个工具**
- 覆盖计算机操作核心循环：**观察**（snapshot / find / get）→ **操作**（click / type_text / set_value / press / scroll / select / focus）→ **验证**（screenshot / snapshot）
- 原生二进制零配置：首次调用任一工具时自动从上游 Releases 下载并缓存（安装阶段无需构建脚本）
- 结构化错误返回（`error.code` + `disposition.retry`），Agent 可据此安全重试

## 系统要求

| 平台 | 架构 |
|------|------|
| Windows | x64 |
| macOS | arm64 / x64 |
| Linux | x64 |

- 已安装 DSH 桌面应用（自带 CLI 与 Node 运行时，**无需单独安装 Node.js / npm**）
- 可访问 GitHub（安装插件与首次下载原生二进制）

## 安装

> **DSH CLI 调用方式**：`dsh` 不在系统 PATH，位于 `<DSH 安装目录>/resources/runtime/cli/bin/`（Windows 为 `dsh.cmd`，macOS/Linux 为 `dsh`）。请将此目录加入 PATH，或将下文示例中的 `dsh` 替换为你本机的完整路径——安装位置因机器而异，不要照抄他人的绝对路径。

**方式一：一条命令从 GitHub 安装**

```bash
dsh plugin --profile desktop add github:hlee-fun/dsh-agent-desktop
```

锁定版本（可复现）：

```bash
dsh plugin --profile desktop add git+https://github.com/hlee-fun/dsh-agent-desktop.git#v1.2.0
```

**方式二：克隆后从本地目录安装**

```bash
git clone https://github.com/hlee-fun/dsh-agent-desktop.git
dsh plugin --profile desktop add ./dsh-agent-desktop
```

安装完成后**重启 DSH 应用**使插件层生效。

## 快速上手

Agent 操作桌面应用的标准循环：

```
list_windows → snapshot(windowId) → find / get（定位元素）
    → click / type_text / set_value / press（操作）
    → snapshot / screenshot（验证结果）
```

## 工具参考

| 工具 | 参数 | 说明 |
|------|------|------|
| `status` | — | 平台、权限、适配器健康状态 |
| `snapshot` | `app?` `windowId?` `depth?` | 读取窗口无障碍树，返回带 `@ref` 的 JSON |
| `find` | `role?` `name?` `value?` `text?` | 按条件搜索元素 |
| `get` | `ref` `property?` | 读取元素属性（text/value/title/bounds/role/states） |
| `click` | `ref` | 通过无障碍动作点击元素 |
| `type_text` | `ref` `text` | 向文本目标输入文字（Windows 自动走剪贴板投递） |
| `set_value` | `ref` `value` | 通过无障碍属性直接设置元素值 |
| `press` | `key` | 按键组合：`return` `escape` `tab` `space` `delete` `方向键` `f1-f12`，修饰键 `ctrl/alt/shift` |
| `wait` | `element?` `text?` `window?` `timeout?` | 等待元素 / 文本 / 窗口出现（默认 30s） |
| `scroll` | `ref` `direction?` `amount?` | 滚动（目标需支持 Scroll 动作） |
| `select` | `ref` `value` | 选择列表 / 下拉框选项 |
| `focus` | `app` | 将应用窗口置于前台 |
| `focus_element` | `ref` | 为元素设置键盘焦点 |
| `screenshot` | `app?` `windowId?` `region?` | 截图，返回 base64 PNG |
| `list_windows` | `app?` | 列出可见窗口（获取 `windowId`） |
| `launch` | `app?` `activate?` | 启动应用 |
| `clipboard_get` | — | 读取剪贴板文本 |
| `clipboard_set` | `text` | 写入剪贴板文本 |

**ref 规则**：`snapshot` 返回 `@<snapshot_id>:eN` 形式的引用，供所有元素操作使用；UI 变化后旧引用失效（`STALE_REF` / `AMBIGUOUS_TARGET`），操作前重新快照。

**示例**：

```json
// snapshot：始终建议指定 windowId（从 list_windows 获取，选主窗口——大 bounds 的那个）
{ "windowId": "w-197510" }

// type_text：向聊天输入框写入
{ "ref": "@s3mqlcadl5xc1g:e193", "text": "你好，世界" }

// press：回车发送
{ "key": "return" }

// scroll：向下滚动一单位（目标 available_actions 须含 Scroll）
{ "ref": "@s3mqlcadl5xc1g:e283", "direction": "down", "amount": 1 }
```

## 故障排查

| 现象 | 原因与处理 |
|------|-----------|
| `type_text` 报 `POLICY_DENIED` 或文字未进入输入框 | Windows 上 Chromium/Electron 输入框忽略物理按键投递；本插件已自动改用 **剪贴板 + Ctrl+V**（实测可上屏）。仍失败时改用 `set_value` |
| `WINDOW_NOT_FOUND` | 无聚焦窗口：先 `list_windows` 取主窗 id（bounds 大者），`snapshot` 传 `windowId` |
| `ACTION_NOT_SUPPORTED`（scroll/select） | 目标元素不支持该动作：换用 `available_actions` 含 `Scroll` / `Select` 的容器元素 |
| 按键被弹窗吞掉 | DSH 全局快捷键（如 Ctrl+A）会打开搜索弹窗抢占焦点：先 `press` `escape` 关闭再操作 |
| 安装时警告 `declares no dsh.bundle` | `package.json` 缺 `dsh.bundle` 声明，插件不会挂载。本仓库已内置该声明（`cordis.patch.yml`），二次开发时请勿删除 |
| macOS 无权限 | 系统设置 → 隐私与安全性 → 辅助功能，授权后重试 |

## 卸载

```bash
dsh plugin --profile desktop remove dsh-agent-desktop
```

## 上游与许可

本项目是**桥接层**，未修改上游任何代码。基于 [vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop) v1.2.0（Apache-2.0）构建，上游版权归 Vercel 及其贡献者所有；本插件同样以 [Apache-2.0](./LICENSE) 许可发布。

上游 CLI 共 65 个命令，本插件桥接其中 17 个核心工具（计算机操作主循环全覆盖）；未桥接的命令（物理鼠标、窗口尺寸、通知管理等）仍可直接调用 CLI 使用。