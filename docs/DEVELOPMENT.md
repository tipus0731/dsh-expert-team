# Expert Team Plugin · Static Installation (Final · Official Paradigm)

English | [中文](DEVELOPMENT.zh.md)

> ✅ **Completed and fully verified end-to-end on 2026-08-15**. The plugin is installed as a **bundle** following DSH's official paradigm (per the `@deepseek-ai/dsh-app-boot`
> README: profile / bundle / out-of-tree plugin mechanism), plug-and-play:
> - `dsh --profile web --dump-config` EXIT=0, the `ui-expert-team` row is in place;
> - Real `defineTool` smoke test: team build → delegation → delivery → cross-validation → verified / rework, all passing;
> - **Real boot on a test port succeeded** (boot audit passed = the plugin row activated; boot manifest and `/plugins/dsh-expert-team/client.js` both served normally);
> - **UI extension completed** (2026-08-15, round 2): a "👥 Expert Team" button in the conversation title bar plus a floating panel (team breakdown / task board / cross-validation), data pushed in **real time over the host `webServer` SSE** routes (/api/expert-team/state + /events); the panel refreshes live when opened; test-boot verified state returns 200 JSON and SSE `: connected` + `event: snapshot` frames;
> - **Company-ratio roster upgrade** (2026-08-15, round 3): added `experts_plan_team` (roster planning tool with built-in software-design / software-dev / data-algorithm / content templates plus a general fallback; role kinds core/design/auxiliary; **software design always includes a visual design role**; **every team includes an auxiliary role** (product manager / coordinator / documentation specialist)); `experts_create_agent` descriptions updated with the team-building principles (independent non-overlapping roles, design tasks get a design role, auxiliary role required); the skill version SKILL.md synced. Verified: 8 tools registered, every template's roles are independent and include design + auxiliary roles, unknown domains fall back to the general roster, INVALID_ARGS validation, test-port boot OK.
> - **Second iteration (2026-08-15, expert-team bootstrap)**: iterated on the plugin itself using Expert Team mode; all 5 tasks verified (t1 state persistence / t2 dependency blocking / t3 panel UI enhancements / t4 README docs / t5 regression + test-boot acceptance). Version 1.0.0 → **1.1.0**.
>   - **t1 persistence**: state archived to `${DSH_HOME|~/.dsh}/storages/expert-team/team.json`, startup restore + serialized last-write-wins writes + in-memory degradation on failure; snapshots gained `persisted`. One rework round (the architect found submit_review notified before settlement changes, so terminal state was not persisted — fixed).
>   - **t2 dependency blocking**: `blockedBy` derived field + submit_result rejects unmet dependencies (with id list).
>   - **t3 panel enhancements**: five-state connection badge, task card expand-details, persistence badge.
>   - **t4 docs**: README gained persistence/dependency sections, panel description updated; one rework round (frontend found the blockedBy description overstated — task cards do not consume blockedBy — fixed).
>   - **t5 regression**: 31+21 assertions independently re-tested, test-boot double-checked green, isSnapshot contract 13 cases.
>   - Exported package synced: `<dev-dir>\dsh-expert-team\` (v1.1.0, 5 files hash-identical).
> - The "cannot create a new session" issue is resolved (the temporary expert preset was removed; the default preset was restored).
>
> The production instance loads v1.1.0 after restart: 8 `experts_*` tools (including `experts_plan_team`), state persistence, dependency blocking, the "👥 Expert Team" title-bar button + live panel (five-state indicator + expand details + persistence badge).
>
> Local pre-change backups exist (`.bak-<timestamp>` copies of `package.json` / `settings.yaml`, local only).

## Goal

Make "Expert Team" a truly persistent Cordis plugin: 8 `experts_*` model tools (**roster** / team build / delegation / delivery / cross-validation / adjudication) plus two UIs: the Expert Team dashboard inside the `experts_status` call card, and a **title-bar button + live floating panel**. One installation, **available in every preset and every session** (tools registered on the host `tools` registry's global layer).

## Final structure (official paradigm)

```
%USERPROFILE%\.dsh\profiles\web\
├─ package.json                  ← dependencies: "dsh-expert-team": "link:./packages/dsh-expert-team"
│                                  dsh.profile.bundles += "dsh-expert-team"
├─ pnpm-workspace.yaml           ← shipped with the profile (packages: ['.'])
├─ packages\dsh-expert-team\     ← plugin package source (single source of truth; link-installed, changes take effect immediately)
│  ├─ package.json               ← main=lib/index.js; exports "."/"./client"/"./package.json";
│  │                               dsh.bundle.patch + dsh.client{inject:[client-runtime],platform:web}
│  ├─ cordis.patch.yml           ← bundle layer: inserts one row { id: ui-expert-team, name: 'dsh-expert-team' }
│  └─ lib\
│     ├─ index.js                ← Host half: 8 experts_* tools (inject: ['tools','webServer'])
│     │                            + versioned snapshot/subscribe; two webServer routes:
│     │                            GET /api/expert-team/state (JSON no-store)
│     │                            GET /api/expert-team/events (SSE: snapshot on connect, push on change)
│     └─ client.js               ← Browser half: __ModuleLoader__ module; three slot registrations:
│                                   · tool.call.toolview key experts_status (call-card dashboard)
│                                   · conversation.session.header.actions entry (👥 button + badge)
│                                   · shell.overlay entry (floating panel, closed via ESC/mask/✕)
│                                    Data: reference-counted shared store — EventSource(SSE) + fetch fallback polling
└─ node_modules\dsh-expert-team  ← pnpm-managed junction → packages\dsh-expert-team
```

Dependency resolution goes entirely through the official mechanism:
- Out-of-tree plugin = `dependencies` in the profile `package.json`, managed by pnpm (per the original README);
- `@deepseek-ai/dsh-tools` (peer) is not installed; it resolves through DSH's self-maintained flat fallback directory `profiles\node_modules\@deepseek-ai\*` (healProfilesModuleFallback) — strictly consistent with the installed version, no duplicate-instance risk;
- Bundle names resolve via dual anchors (installation directory → profile directory); bare package names resolve from the profile directory.

## Key design decisions (verified against source)

1. **One row, two roles**: the `ui-expert-team` row uses the bare package name. The Loader loads the root export (the tool plugin) → tools go into the tools registry's **global layer** (the `view(scope)` inheritance surface is visible to every session, per dsh-tools `register` docs: "Register globally or in the calling agent scope"); the client-module scanner reads the same package's `dsh.client` declaration via `require.resolve('<row name>/package.json')` (anchored at ctx.baseUrl = the profile directory) → the dashboard goes into `window.__DSH_BOOT__`.
2. **No dedicated preset needed**: tools live on the global layer, usable from sessions of any preset (standard/code/cordis…); the experimental expert preset used mid-development was removed and the default preset restored.
3. **Dashboard data channel (tool card)**: `output.presentationMeta(args, value) => value` persists the team snapshot with the `tool/result` event; the client `ToolResultNode.meta` renders it directly (no RPC, no polling; replaying a historical session renders the snapshot of that moment).
4. **Live panel data channel (floating panel)**: the host `webServer` service registers two routes (same pattern as `dsh-client-hmr`: register inside `ctx.effect`, destroy connections on teardown) — the state route returns versioned JSON; the events route is an SSE long connection (full snapshot on connect, `notify()` broadcast on every change). The browser-side module store shares one EventSource by reference counting — first subscriber connects, last subscriber disconnects; falls back to polling when EventSource is unavailable.
5. **Cross-row service access must declare inject**: `ctx.get('webServer')` only sees services injected into the row (measured: without inject it returns undefined and routes 404); the official pattern (dsh-client-hmr) is `inject: ['clientModules', 'webServer']` — the Loader resolves injections and provides the services into the row's context. This plugin uses `inject: ['tools','webServer']`; on non-web mounts `ctx.get` skips the routes as a fallback.
6. **`link:` rather than `file:` dependency**: pnpm `file:` copies the directory (changes do not propagate); `link:` creates a junction — source is the installation, iteration costs nothing.

## Verification record (2026-08-15)

| Item | Result |
|---|---|
| `pnpm install` (corepack pnpm@10) | EXIT=0, junction in effect, source changes visible immediately |
| `import('dsh-expert-team')` from the profile anchor | OK (dsh-tools resolved via flat fallback) |
| `apply` + 8 tools registered (real defineTool) | OK |
| Full flow: 3 experts → delegate → deliver → two reviews approve → verified | OK |
| Rework path: needs_changes → rework + findings list | OK |
| `presentationMeta` snapshot channel | OK |
| `dsh --profile web --dump-config` | EXIT=0, row in place |
| **Real boot on a test port** (boot audit passed) | 200 + manifest includes the plugin + client.js 200 |
| Test-port round 2 (UI extension) state route | 200, JSON snapshot (with version) |
| Test-port round 2 SSE route | 200 `text/event-stream`, `: connected` + `event: snapshot` frames |
| Full flow + notify version increments | OK (incl. busy-expert removal guard, verified-removal allowed) |
| Production-instance session creation (default preset) | back to normal |

## After installation

Restart DSH, then:
- every session (including existing presets) shows the 8 `experts_*` tools in its tool list;
- the **"👥 Expert Team" button** appears in the conversation title bar (badged while open tasks > 0) → opens the live floating panel (team breakdown / task board / cross-validation tabs), SSE-pushed in real time, no manual refresh;
- calling `experts_status` still renders the call-card dashboard;
- page refresh is safe (the new client.js is loaded via a new rev parameter).

## Uninstall / rollback

1. `profiles\web\package.json`: remove `dsh-expert-team` from `dependencies` and `dsh.profile.bundles` (or restore a local `.bak-<timestamp>` backup);
2. delete `profiles\web\packages\dsh-expert-team\` and `profiles\web\node_modules\dsh-expert-team` (the junction);
3. restart DSH. All plugin traces disappear with the bundle layer; no residual state.

## Evolution history (troubleshooting notes)

1. **Dynamic Cordis plugin route**: blocked by a harness text-protocol oneOf parameter-passing defect (`cordis_define.plugin` always arrived as a string; reproduced multiple times, including calls inside subagents). The dynamic version's source is kept at `<dev-dir>\expert-team\plugin\` (including INSTALL.md reproduction notes).
2. **First static installation** (manual junction + expert preset + default-preset switch): after restart, "cannot create a new session" — root cause: walking up from the junction target's real path, Node could not find `@deepseek-ai/dsh-tools`, so preset mounting was rejected and session creation rolled back.
3. **Final version**: rebuilt per the official paradigm as an in-profile bundle + pnpm link install + global tool layer; removed the temporary preset and all manual junctions; verified with a real test boot.
4. **UI extension (round 2)**: first mapped the client data channels (Inspected: the client Builtins `host.call` is only available to dynamic plugins; static modules use webServer HTTP routes + SSE, with `dsh-client-hmr` as the official example); slot contracts taken from `dsh-client-ui-conversation/contract/slots.d.ts` and `dsh-client-ui-layout/index.d.ts` (header.actions is a session-scoped list slot, shell.overlay is a root-scoped list slot with click-through layers by default — entries need pointer-events:auto); troubleshooting note: the first version did not declare webServer in inject → `ctx.get('webServer')` returned undefined and routes 404; after adding `inject: ['tools','webServer']` per the official pattern the routes worked.
5. Skill-version fallback (no installation needed, took effect immediately): `%USERPROFILE%\.dsh\skills\expert-team\SKILL.md`, teaching any session to run the same Expert Team flow with the existing subagent tool (ledger mode, no dashboard).
