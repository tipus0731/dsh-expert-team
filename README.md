# dsh-expert-team

English | [中文](README.zh.md)

Expert Team (专家团) plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): organize role-bounded, responsibility-separated expert agents like the Qoder Expert Team. Tasks are delegated to their owners and every delivery is **cross-validated** by other experts — a task is only closed after unanimous approval.

- **8 model tools**: `experts_plan_team` (roster planning) / `experts_create_agent` (team building) / `experts_open_task` (delegation) / `experts_submit_result` (delivery) / `experts_request_review` (review assignment) / `experts_submit_review` (verdict recording) / `experts_status` (overview) / `experts_remove_agent` (removal)
- **Two UIs**: a dashboard inside the `experts_status` call card (team breakdown / task board / cross-validation matrix); a **"👥 Expert Team" button in the conversation title bar** plus a live floating panel (SSE push, no manual refresh)
- **v1.1.0 additions**: team state persisted to disk (`${DSH_HOME|~/.dsh}/storages/expert-team/team.json`, restored on restart); task `dependsOn` dependency blocking (deliveries rejected while dependencies are unmet); panel gained a connection-state indicator (disconnected / connecting / live / reconnecting / polling) and a persistence badge (persisted / in-memory); task cards gained "expand details"
- **Team-building principles**: mirror real-world company staffing ratios with mutually independent, non-overlapping roles; design tasks (software UI/visual/interaction/layout) always include a **visual design role**; every team includes one **auxiliary role** (product manager / coordinator / documentation specialist)

## Installation

The plugin follows DSH's official profile/bundle paradigm (out-of-tree plugin + `link:` dependency) and works out of the box:

1. **Place the plugin package**: copy this directory to
   `%USERPROFILE%\.dsh\profiles\<profile>\packages\dsh-expert-team\`
   (`<profile>` is usually `web`; you may also put it anywhere else and use a relative path in the next step).

2. **Edit the profile's package.json** (`%USERPROFILE%\.dsh\profiles\<profile>\package.json`):

   ```json
   {
     "dependencies": {
       "dsh-expert-team": "link:./packages/dsh-expert-team"
     },
     "dsh": {
       "profile": {
         "bundles": [
           "@deepseek-ai/dsh-base",
           "@deepseek-ai/dsh-web-app",
           "dsh-expert-team"
         ]
       }
     }
   }
   ```

3. **Install dependencies** (inside the profile directory; requires pnpm 10+):

   ```bash
   corepack pnpm@10 install
   ```

4. **Restart DSH**. The tools are registered on the host `tools` registry's **global layer**, so they are available in every preset and every session.

## Usage

In any session, just say:

> Complete 【task】 with the Expert Team mode: first build the team with company-style staffing ratios, then cross-validate every delivery before closing.

The agent will call `experts_plan_team` to produce a roster → `experts_create_agent` to build experts role by role → `experts_open_task` to delegate (with clear acceptance criteria) → execute via subagents → `experts_submit_result` to deliver → `experts_request_review` / `experts_submit_review` for cross-validation (owners cannot review their own work) → unanimous approval yields `verified`, otherwise the task returns to `rework` with a list of findings.

The **"👥 Expert Team"** button in the conversation title bar (badged while open tasks > 0) opens the live panel showing team and task status at any time. The panel header shows the **connection-state indicator** (disconnected / connecting / live / reconnecting / polling — "disconnected" is transient when no subscriber is connected) and the **persistence badge** (persisted / in-memory). Every task card can be **expanded** to show the full objective, delivery summary, rework findings, and review findings.

## How it works / Architecture

```
dsh-expert-team/
├─ package.json        ← main=lib/index.js; exports "."/"./client"; dsh.bundle.patch + dsh.client
├─ cordis.patch.yml    ← bundle layer: inserts one row { id: ui-expert-team, name: 'dsh-expert-team' }
└─ lib/
   ├─ index.js         ← Host half: 8 experts_* tools (inject: ['tools','webServer'])
   │                      + versioned snapshots + disk persistence + task dependency blocking;
   │                      two webServer routes:
   │                      GET /api/expert-team/state (JSON)
   │                      GET /api/expert-team/events (SSE push)
   └─ client.js        ← Browser half: three slot registrations (tool.call.toolview /
                          conversation.session.header.actions / shell.overlay)
                          + connection state machine + task card expand-details + persistence badge
```

- The plugin row is both a host row (root export registers global tools) and a client module (`dsh.client` declaration goes into `window.__DSH_BOOT__`) — one row, two roles;
- Only `peerDependencies` are declared (`@deepseek-ai/dsh-tools`, `@deepseek-ai/cordis`), provided by the host DSH — no duplicate instances;
- Panel data is pushed in real time over `webServer` SSE; the browser side shares a single EventSource by reference counting and degrades to polling when unavailable;
- Team state (agents / tasks / counters / version) is asynchronously persisted to disk on every change and restored at startup; a failed write silently degrades to in-memory mode, and the snapshot's `persisted` field reflects the current persistence state.

## State persistence

Since v1.1.0, the Expert Team state (experts / tasks / counters / version) is asynchronously written to a disk archive on every change and automatically restored after a DSH restart — no manual backup or rebuild needed.

- **Location**:
  `${DSH_HOME or ~/.dsh}/storages/expert-team/team.json`
  (resolved by `resolveStorePath()`: the `DSH_HOME` environment variable takes precedence, otherwise `.dsh` under the user home; consistent with DSH's own storage layout, no hardcoded absolute paths).
- **Startup restore**: `apply` reads the archive at startup and validates every record's fields (a missing required field or invalid JSON invalidates the whole archive); on a successful restore the archived state is used; on a read failure (missing / corrupt) it starts from empty state without crashing.
- **Write strategy**: changes are written asynchronously with serialization control (a `pending` flag plus **last-write-wins** for the latest content); concurrent changes collapse into the last content, with at most one write in flight at any time.
- **Degradation**: when writes fail (missing parent directory / insufficient permissions / disk errors) the plugin **silently degrades to in-memory mode** — no exceptions, no blocked tool calls; persistence resumes automatically once writes succeed. The snapshot carries a `persisted` field: `true` = archive loaded successfully or last write succeeded (persisted), `false` = in-memory mode.
- **Panel display**: the floating panel's title bar shows the "persisted" or "in-memory" badge accordingly; the `experts_status` snapshot API and SSE pushes carry the same field.

## Task dependencies

Since v1.1.0, `experts_open_task` supports declaring prerequisite tasks via `dependsOn` (optional, a list of taskIds), for orchestrating complex tasks with ordering constraints.

- **Blocking rule**: a task is blocked if and only if any of its dependencies is **not in a terminal state**. Terminal states are `verified` and `cancelled`; a missing dependency, or one still `open` / `review` / `rework`, counts as incomplete → blocked.
- **Derived field `blockedBy`**: every task snapshot derives a `blockedBy` field (the list of unmet dependency ids; an empty array when unblocked). It is not part of the persisted structure and is computed live by `blockedByFor()`. "Dependency blocked: … incomplete" appears in `experts_status`'s text output; **task cards display only the declared `dependsOn` list** (`blockedBy` ships with the snapshot; the frontend does not consume it yet).
- **Submission guard**: when `experts_submit_result` submits a delivery with a non-empty `blockedBy`, the submission is **rejected** and the list of blocking dependency ids is returned; the delivery may only be registered and sent to review once all dependencies are satisfied (each dependency `verified` or `cancelled`).
- **Validation**: `experts_open_task` validates at creation time that every `dependsOn` id corresponds to an existing task; unknown ids fail with an error — no dangling dependencies.

## Customization

- **Row id conflicts**: if a deployment already uses the `ui-expert-team` row id, change the `id` in `cordis.patch.yml` (`name` must stay the bare package name `dsh-expert-team` — the client-module scanner depends on it).
- **Roster templates**: `ROSTER_TEMPLATES` / `GENERAL_ROSTER` at the top of `lib/index.js` are the data source for `experts_plan_team` — add/remove roles or adjust responsibility boundaries directly there.
- **Reserved routes**: `/api/expert-team/state` and `/api/expert-team/events` are owned by this plugin; do not collide with other routes.

## Uninstall

1. Remove `dsh-expert-team` from the profile `package.json`'s `dependencies` and `dsh.profile.bundles`;
2. Delete `packages\dsh-expert-team\` and `node_modules\dsh-expert-team`;
3. Restart DSH. No residual state remains.

## Compatibility

- Target DSH version family: `0.1.0-rc.6` (peer dependency `@deepseek-ai/dsh-tools ^0.1.0-rc.6`). If tool or `webServer` service contracts change after a DSH upgrade, update this plugin accordingly.
- No absolute paths, machine-specific configuration, or hardcoded ports — purely relative paths, portable across platforms.

## Development history

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full development log (installation research, design decisions, and verification records).
