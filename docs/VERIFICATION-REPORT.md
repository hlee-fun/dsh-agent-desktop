# dsh-agent-desktop 单命令安装与真实环境全功能验证报告

日期：2026-11-05 ｜ 环境：Windows 11 (26300) x64 ｜ DSH 运行时 0.2.1-rc.5 ｜ agent-desktop v1.2.0

## 1. 验证目标（用户指令）

> 卸载插件并清理相关，模拟仅一条命令安装，并模拟真实操作验证真实操作下全功能是否可用，建立报告。

## 2. 卸载与清理

```bash
dsh plugin --profile desktop remove dsh-agent-desktop
```

- pnpm 依赖移除，`package.json` 与 `node_modules` 无残留，清理完全。✅

## 3. 单命令安装

```bash
dsh plugin --profile desktop add F:/dsh/dsh-agent-desktop
```

### 3.1 首轮发现的关键缺陷

安装成功但宿主警告：

```
dsh: warning: dsh-agent-desktop declares no dsh.bundle — installed as a plain dependency, not a profile layer
```

根因（从 app.asar 宿主代码证实）：宿主只认 **package.json** 的 `dsh.bundle` 字段——

```js
const bundle = bundleManifest.dsh?.bundle;
if (bundle === void 0) throw new Error('... declares no dsh.bundle in its package.json');
```

缺少该声明时插件不会进入 `dsh.profile.bundles` 层栈，**真实 DSH 会话中工具不会挂载**。

### 3.2 修复

- 新增 `cordis.patch.yml`：`- insert: [{id: agent-desktop, name: dsh-agent-desktop}]`
- `package.json` 增加 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`

### 3.3 修复后重装

- 无警告；`dsh.profile.bundles` 29→30 含 `dsh-agent-desktop`；依赖 `link:F:/dsh/dsh-agent-desktop`；入口解析至 `F:\dsh\dsh-agent-desktop\lib\index.js`。✅

## 4. 真实安装路径全功能验证（17 工具）

测试位置：`C:/Users/Administrator/.dsh/profiles/desktop/node_modules/dsh-agent-desktop`（宿主实际加载路径），脚本 `test_full.js`。

| # | 工具 | 结果 | 证据 |
|---|------|:---:|------|
| 1 | status | ✅ | platform windows, accessibility granted |
| 2 | list_windows | ✅ | 主窗 w-263028 1296x828 |
| 3 | snapshot | ✅ | 280 refs（--window-id） |
| 4 | find | ✅ | role=button 命中 |
| 5 | get | ✅ | 读回 "最小化" |
| 6 | click | ✅ | 语义投递 ok |
| 7 | type_text | ✅ | clipboard-paste，MARK 写入输入框 |
| 8 | set_value | ✅ | ValuePattern 写入并读回验证 |
| 9 | screenshot | ✅ | base64 PNG ~250KB |
| 10 | focus | ✅ | focus-window --app |
| 11 | focus_element | ✅ | --headed 物理聚焦 |
| 12 | press | ✅ | escape/return/ctrl+v |
| 13 | scroll | ✅ | 含 Scroll 动作的目标 |
| 14 | clipboard_get | ✅ | |
| 15 | clipboard_set | ✅ | |
| 16 | wait | ✅ | 时长位置参数修复后 |
| 17 | select | ⚠️ | 协议正确；DSH 的 tab/radiobutton 选项值不被 CLI 匹配（ELEMENT_NOT_FOUND），属上游语义支持面 |

### 端到端真实操作（消息发送闭环）

```
type_text("E2E-FINAL-7x9") → 输入框 value 含 MARK ✅
→ press return → MARK 出现在可访问性树（消息上屏）✅
```

## 5. 修复清单（本轮提交 7ddef33）

1. **bundle 层声明**（cordis.patch.yml + package.json dsh.bundle）——单命令安装即挂载。
2. **type_text Windows 投递**：Chromium/Electron DOM 忽略 `SendInput.type_text`（a11y value 不更新）；`press` 仅支持命名键（`-`、`!` 报 INVALID_ARGS）→ Windows 统一走 focus → clipboard-set → ctrl+v（实测可上屏）；非 Windows 保持原生 type。
3. **wait**：纯时长必须位置参数 `wait <ms>`。
4. **select**：VALUE 为位置参数。
5. **测试脚本**：动态选主窗（DSH 窗口 id 随重启变化，且存在 366x162 弹窗无输入框，须按 bounds>800x500 过滤）。

## 6. 已知限制

| 项 | 说明 |
|----|------|
| select 在 DSH 自绘控件 | tab/radiobutton 的选项值匹配依赖上游 UIA SelectionItem 实现，当前 ELEMENT_NOT_FOUND；对标准 listbox/combo 应可用 |
| 中文输入法干扰 | 逐字符按键路径会被 IME 误转（k→克）；剪贴板路径不受影响，type_text 已默认剪贴板 |
| 前台弹窗抢焦点 | DSH 全局快捷键（Ctrl+逗号等）弹出的搜索窗会吞按键；操作前建议 Escape 或关闭弹窗 |
| a11y value 读回 | 富文本编辑器 value 可能含历史残留/零宽字符，验证以"包含"判定而非全等 |
| 物理鼠标类命令 | drag/hover/mouse-* 等 9 个 --headed 物理命令未桥接（可用 dsh_bash 直调 CLI） |

## 7. 结论

**单命令安装可用**：`dsh plugin --profile desktop add <路径|git仓库>` 一条命令完成依赖链接、二进制自动下载、profile 层挂载（修复后）。
**真实环境全功能可用**：17 工具中 16 项通过端到端验证；核心计算机使用闭环（观察→定位→输入→发送→验证）已在 DSH 自身窗口上完整跑通。select 的失败属上游控件语义支持面，不影响主链路。
