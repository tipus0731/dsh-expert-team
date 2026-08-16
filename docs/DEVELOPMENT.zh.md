# 专家团插件 · 静态安装（最终版 · 官方范式）

[English](DEVELOPMENT.md) | 中文

> ✅ **2026-08-15 完成并全链路验证**。插件按 DSH 官方范式（`@deepseek-ai/dsh-app-boot`
> README：profile/bundle/树外插件机制）安装为 **bundle**，即插即用：
> - `dsh --profile web --dump-config` EXIT=0，`ui-expert-team` 行就位；
> - 真实 `defineTool` 冒烟测试：组队 → 委派 → 交付 → 交叉验证 → verified / rework 全通；
> - **测试端口真实试启动成功**（通过 boot 审计 = 插件行激活成功；boot manifest 与
>   `/plugins/dsh-expert-team/client.js` 均正常服务）；
> - **UI 扩展已完成**（2026-08-15 第二轮）：会话标题栏「👥 专家团」按钮 + 浮动面板
>   （团队分工/任务看板/交叉验证），数据经宿主 `webServer` 路由 **SSE 实时推送**
>   （/api/expert-team/state + /events），面板打开即实时刷新；试启动验证
>   state 200 JSON、SSE `: connected` + `event: snapshot` 帧正常；
> - **大公司配比升级**（2026-08-15 第三轮）：新增 `experts_plan_team`（配比规划工具，
>   内置 software-design / software-dev / data-algorithm / content 模板 + 通用兜底；
>   岗位类型 core/design/auxiliary；**软件设计必含美术设计岗**；**每组必配辅助岗**
>   （产品经理/协调员/文档专员））；`experts_create_agent` 描述同步写入组队原则
>   （岗位独立不重叠、设计类任务加美术岗、配辅助岗）；技能版 SKILL.md 同步。
>   验证：8 工具注册、各模板岗位独立且含设计岗+辅助岗、缺省走通用配比、
>   INVALID_ARGS 校验、测试端口启动正常。
> - **二次迭代（2026-08-15 专家团自举）**：用专家团模式迭代插件本身，5 项任务全部
>   verified（t1 状态持久化 / t2 依赖阻塞 / t3 面板 UI 增强 / t4 README 文档 /
>   t5 回归测试+试启动验收）。版本 1.0.0 → **1.1.0**。
>   - **t1 持久化**：状态落盘 `${DSH_HOME|~/.dsh}/storages/expert-team/team.json`，
>     启动恢复 + 串行化 last-write-wins 写盘 + 失败降级内存模式；快照新增 `persisted`。
>     经 1 轮返工（架构师发现 submit_review 的 notify 早于结算变更、终态不落盘——已修）。
>   - **t2 依赖阻塞**：`blockedBy` 派生字段 + submit_result 拒绝未满足依赖（含 id 列表）。
>   - **t3 面板增强**：连接状态机五态徽标、任务卡展开详情、持久化徽标。
>   - **t4 文档**：README 新增持久化/依赖小节、面板描述更新；经 1 轮返工
>     （前端发现 blockedBy 描述夸大——任务卡并不消费 blockedBy，已修）。
>   - **t5 回归**：31+21 断言独立复测、试启动双人实测全绿、isSnapshot 契约 13 用例。
>   - 导出包已同步：`<dev-dir>\dsh-expert-team\`（v1.1.0，5 文件哈希一致）。
> - 「无法创建新会话」问题已消除（临时 expert 预设已删除，默认预设已还原）。
>
> 正式实例重启后加载 v1.1.0：8 个 `experts_*` 工具（含 `experts_plan_team`）、状态持久化、
> 依赖阻塞、标题栏「👥 专家团」按钮 + 实时面板（五态状态指示 + 展开详情 + 持久化徽标）。
>
> 本地留有变更前备份（`package.json` / `settings.yaml` 的 `.bak-<时间戳>` 副本，仅本地存在）。

## 目标

把「专家团」做成真正持久化的 Cordis 插件：8 个 `experts_*` 模型工具（**配比** / 组队 / 委派 /
交付 / 交叉验证 / 裁决）+ 两块 UI：`experts_status` 调用卡片内的专家团仪表盘，以及**会话标题栏
按钮 + 实时浮动面板**。一次安装，**所有预设、所有会话**可用（工具注册在宿主 tools
注册表全局层）。

## 最终结构（官方范式）

```
%USERPROFILE%\.dsh\profiles\web\
├─ package.json                  ← dependencies: "dsh-expert-team": "link:./packages/dsh-expert-team"
│                                  dsh.profile.bundles += "dsh-expert-team"
├─ pnpm-workspace.yaml           ← profile 自带（packages: ['.']）
├─ packages\dsh-expert-team\     ← 插件包源（唯一事实源，link 安装，改动即时生效）
│  ├─ package.json               ← main=lib/index.js；exports "."/"./client"/"./package.json"；
│  │                               dsh.bundle.patch + dsh.client{inject:[client-runtime],platform:web}
│  ├─ cordis.patch.yml           ← bundle 层：insert 一行 { id: ui-expert-team, name: 'dsh-expert-team' }
│  └─ lib\
│     ├─ index.js                ← Host 半：8 个 experts_* 工具（inject: ['tools','webServer']）
│     │                            + 版本化快照/subscribe；webServer 两条路由：
│     │                            GET /api/expert-team/state（JSON no-store）
│     │                            GET /api/expert-team/events（SSE：连接即发快照，变更即推送）
│     └─ client.js               ← Browser 半：__ModuleLoader__ 模块；三处插槽注册：
│                                   · tool.call.toolview 键 experts_status（调用卡片仪表盘）
│                                   · conversation.session.header.actions 条目（👥 按钮+角标）
│                                   · shell.overlay 条目（浮动面板，ESC/遮罩/✕ 关闭）
│                                   数据：引用计数共享 store——EventSource(SSE)+fetch 兜底轮询
└─ node_modules\dsh-expert-team  ← pnpm 管理的 junction → packages\dsh-expert-team
```

依赖解析完全走官方机制：
- 树外插件 = profile `package.json` 的 dependencies，由 pnpm 管理（README 原文）；
- `@deepseek-ai/dsh-tools`（peer）不安装，经 DSH 自维护的扁平回退目录
  `profiles\node_modules\@deepseek-ai\*`（healProfilesModuleFallback）解析——
  与安装版本严格一致，无重复实例风险；
- bundle 名双锚点解析（安装目录 → profile 目录），裸包名从配置目录解析。

## 关键设计决策（对照源码验证）

1. **一行两用**：`ui-expert-team` 行用裸包名。Loader 加载 root 导出（工具插件）→ 工具进
   tools 注册表**全局层**（`view(scope)` 的继承面对所有会话可见，dsh-tools `register`
   文档："Register globally or in the calling agent scope"）；客户端模块扫描器按
   `require.resolve('<行名>/package.json')`（锚定 ctx.baseUrl=profile 目录）读取同一包的
   `dsh.client` 声明 → 仪表盘进 `window.__DSH_BOOT__`。
2. **无需专用预设**：工具在全局层，任何预设（standard/code/cordis…）的会话都能用；
   中途实验用的 expert 预设已删除，默认预设已还原。
3. **仪表盘数据通道（工具卡片）**：`output.presentationMeta(args, value) => value` 把团队快照随
   `tool/result` 事件持久化，客户端 `ToolResultNode.meta` 直接渲染（无 RPC、无轮询、
   回放历史会话也能渲染当时的快照）。
4. **实时面板数据通道（浮动面板）**：宿主 `webServer` 服务注册两条路由
   （`dsh-client-hmr` 同款范式：`ctx.effect` 内 register，卸载时销毁连接）——
   state 路由返回版本化 JSON；events 路由 SSE 长连接（连接即发全量快照，每次变更
   `notify()` 广播）。浏览器端模块级 store 用引用计数共享一条 EventSource，
   首订阅者建连、末订阅者断开；EventSource 不可用时降级轮询。
5. **跨行服务访问必须声明 inject**：`ctx.get('webServer')` 只看得见注入过本行的服务
   （实测未 inject 时返回 undefined、路由 404）；官方范式（dsh-client-hmr）是
   `inject: ['clientModules', 'webServer']`——加载器解析注入后把服务 provide 到本行
   上下文。本插件 `inject: ['tools','webServer']`，非 web 挂载时 `ctx.get` 兜底跳过路由。
6. **link: 而非 file: 依赖**：pnpm `file:` 会复制目录（改动不传播）；`link:` 建 junction，
   源码即安装，迭代零成本。

## 验证记录（2026-08-15）

| 项 | 结果 |
|---|---|
| `pnpm install`（corepack pnpm@10） | EXIT=0，junction 生效，源码改动即时可见 |
| 从 profile 锚点 `import('dsh-expert-team')` | OK（dsh-tools 经扁平回退解析） |
| `apply` + 8 工具注册（真实 defineTool） | OK |
| 完整流程：3 专家→委派→交付→双评审 approve→verified | OK |
| 返工路径：needs_changes→rework+问题清单 | OK |
| `presentationMeta` 快照通道 | OK |
| `dsh --profile web --dump-config` | EXIT=0，行就位 |
| **测试端口真实启动**（boot 审计通过） | 200 + manifest 含插件 + client.js 200 |
| 测试端口第二轮（UI 扩展）state 路由 | 200，JSON 快照（含 version） |
| 测试端口第二轮 SSE 路由 | 200 `text/event-stream`，`: connected` + `event: snapshot` 帧 |
| 完整流程 + notify 版本号（逐次递增） | OK（含 busy 专家移除拦截、verified 移除放行） |
| 正式实例会话创建（默认预设） | 恢复正常 |

## 安装后生效

重启 DSH 后：
- 任意会话（含现有预设）的工具列表都会出现 8 个 `experts_*` 工具；
- 会话标题栏出现 **「👥 专家团」按钮**（进行中任务>0 时带角标）→ 点开实时浮动面板
  （团队分工 / 任务看板 / 交叉验证三页签），数据 SSE 实时推送，无需手动刷新；
- 调用 `experts_status` 依旧渲染工具卡片仪表盘；
- 页面刷新恢复安全（新 client.js 由新 rev 参数加载）。

## 卸载 / 回滚

1. `profiles\web\package.json`：从 `dependencies` 与 `dsh.profile.bundles` 移除
   `dsh-expert-team`（或还原本地 `.bak-<时间戳>` 备份）；
2. 删除 `profiles\web\packages\dsh-expert-team\` 与
   `profiles\web\node_modules\dsh-expert-team`（junction）；
3. 重启 DSH。插件所有痕迹随 bundle 层消失，无残留状态。

## 演进历史（排查记录）

1. **动态 Cordis 插件路线**：被 harness 文本工具协议 oneOf 参数投递缺陷阻塞
   （`cordis_define.plugin` 永远以字符串到达；多次复现，含 subagent 内调用）。
   动态版源码留存于 `<dev-dir>\expert-team\plugin\`（含 INSTALL.md 复现记录）。
2. **首版静态安装**（手工 junction + expert 预设 + 默认预设切换）：重启后「无法创建新会话」
   ——根因：junction 目标真实路径处 Node 向上找不到 `@deepseek-ai/dsh-tools`，预设挂载被拒、
   会话创建回滚。
3. **最终版**：按官方范式重构为 profile 内 bundle + pnpm link 安装 + 全局工具层，
   删除临时预设与全部手工 junction；经真实试启动验证。
4. **UI 扩展（第二轮）**：先查清客户端数据通道（Inspect：client Builtins 的 `host.call`
   仅动态插件可用；静态模块走 webServer HTTP 路由 + SSE，`dsh-client-hmr` 为官方范例）；
   槽位契约取自 `dsh-client-ui-conversation/contract/slots.d.ts` 与
   `dsh-client-ui-layout/index.d.ts`（header.actions 为 session 作用域列表槽，
   shell.overlay 为 root 作用域列表槽、层默认 click-through、条目需 pointer-events:auto）；
   排障记录：首版未在 inject 声明 webServer → `ctx.get('webServer')` 返回 undefined、
   路由 404；按官方范式补 `inject: ['tools','webServer']` 后路由即通。
5. 技能版兜底（无需安装、已即时生效）：`%USERPROFILE%\.dsh\skills\expert-team\SKILL.md`，
   教任意会话用现有 subagent 工具跑同款专家团流程（账本模式，无仪表盘）。
