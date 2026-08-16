window.__ModuleLoader__.load({
	id: "dsh-expert-team",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region expert-team client
		/**
		 * Expert Team browser half:
		 * - `tool.call.toolview` keyed row for experts_status (dashboard card).
		 * - `conversation.session.header.actions` entry: a title-bar button with
		 *   a live active-task badge; click toggles the floating panel.
		 * - `shell.overlay` entry: the floating dashboard panel.
		 *
		 * Live data: a shared reference-counted store subscribes to the host
		 * SSE endpoint /api/expert-team/events (full snapshot per event) with
		 * a JSON polling fallback at /api/expert-team/state. The first
		 * subscriber opens the channel, the last one closes it.
		 */
		const STYLE_ID = "dsh-expert-team-style";
		// Minimal, quiet styling: neutral grays on theme tokens, hairline
		// borders, no saturated accents. Information is carried by text
		// labels and small monochrome dots, never by color alone.
		const CSS = [
			".xteam-root{display:flex;flex-direction:column;gap:10px;font-size:12px;line-height:1.55;padding:10px 12px;color:var(--dsw-alias-label-primary,inherit)}",
			".xteam-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".xteam-title{font-weight:600;font-size:13px;margin-right:2px;color:var(--dsw-alias-label-primary,currentColor)}",
			// status chips: text label + colored dot (restrained, readable)
			".xteam-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;line-height:18px;white-space:nowrap;color:var(--dsw-alias-label-secondary,inherit)}",
			".xteam-chip::before{content:\"●\";font-size:8px;line-height:1}",
			".st-open{color:#b58a2a}",
			".st-open::before{color:#b58a2a}",
			".st-review{color:#3b7dd8}",
			".st-review::before{color:#3b7dd8}",
			".st-rework{color:#c25b4e}",
			".st-rework::before{color:#c25b4e}",
			".st-verified{color:#2e9e5b}",
			".st-verified::before{color:#2e9e5b}",
			".st-muted{opacity:.6}",
			// tabs: underline style, no fill
			".xteam-tabs{display:inline-flex;gap:2px;margin-left:auto}",
			".xteam-tab{font:inherit;font-size:12px;padding:3px 10px 2px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--dsw-alias-label-tertiary,inherit);cursor:pointer;opacity:.85}",
			".xteam-tab:hover{opacity:1;color:var(--dsw-alias-label-secondary,inherit)}",
			".xteam-tab.active{opacity:1;color:var(--dsw-alias-label-primary,inherit);border-bottom-color:var(--dsw-alias-label-primary,currentColor);font-weight:600}",
			".xteam-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}",
			".xteam-card{border:1px solid var(--dsw-alias-border-l1,color-mix(in srgb,currentColor 12%,transparent));border-radius:6px;padding:8px 10px;background:transparent;display:flex;flex-direction:column;gap:5px}",
			".xteam-card-head{display:flex;align-items:center;gap:8px}",
			".xteam-avatar{width:24px;height:24px;border-radius:4px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,currentColor 7%,transparent);border:1px solid color-mix(in srgb,currentColor 10%,transparent);color:var(--dsw-alias-label-secondary,inherit);font-weight:600;font-size:12px;flex:none}",
			".xteam-name{font-weight:600;color:var(--dsw-alias-label-primary,inherit)}",
			".xteam-role{opacity:.7}",
			".xteam-row{display:flex;flex-wrap:wrap;gap:4px}",
			".xteam-tag{padding:0 6px;border-radius:3px;background:color-mix(in srgb,currentColor 6%,transparent);opacity:.8}",
			".xteam-duties{margin:0;padding-left:16px;opacity:.85}",
			".xteam-stats{opacity:.65}",
			".xteam-section-title{font-weight:600;margin:2px 0 6px;color:var(--dsw-alias-label-primary,inherit)}",
			".xteam-meta{opacity:.7}",
			".xteam-crit{margin:0;padding-left:16px;opacity:.8}",
			".xteam-findings{margin:0;padding-left:16px;opacity:.85}",
			".xteam-table{border-collapse:collapse;font-size:12px;width:100%}",
			".xteam-table th,.xteam-table td{border:1px solid var(--dsw-alias-border-l1,color-mix(in srgb,currentColor 10%,transparent));padding:3px 8px;text-align:center}",
			".xteam-table th{font-weight:600;color:var(--dsw-alias-label-secondary,inherit)}",
			".xteam-table th:first-child,.xteam-table td:first-child{text-align:left}",
			// verdict marks: muted colors, weight carries emphasis
			".vd-approve{color:#2e9e5b;font-weight:600}",
			".vd-reject{color:#c25b4e;font-weight:600}",
			".vd-changes{color:#b58a2a;font-weight:600}",
			".vd-pending{opacity:.45}",
			".xteam-owner{color:#3b7dd8;font-weight:600}",
			".xteam-empty{border:1px dashed color-mix(in srgb,currentColor 22%,transparent);border-radius:6px;padding:14px;opacity:.75}",
			".xteam-hint{opacity:.55}",
			".xteam-fallback{white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary,inherit);padding:8px 0;font-size:13px}",
			// header button: plain text, quiet badge
			".xteam-hbtn{display:inline-flex;align-items:center;gap:4px;min-height:28px;padding:3px 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary,inherit);font:inherit;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap}",
			".xteam-hbtn:hover,.xteam-hbtn:focus-visible{color:var(--dsw-alias-label-secondary,inherit);background:color-mix(in srgb,currentColor 7%,transparent)}",
			".xteam-hbtn-active{color:var(--dsw-alias-label-primary,inherit)}",
			".xteam-hbtn-badge{min-width:15px;padding:0 4px;border-radius:999px;background:color-mix(in srgb,currentColor 20%,transparent);color:var(--dsw-alias-label-primary,inherit);font-size:10px;line-height:15px;text-align:center;font-variant-numeric:tabular-nums}",
			// right-side drawer (click-through outside, panel owns its area)
			".xteam-overlay{position:fixed;inset:0;z-index:1000;pointer-events:none}",
			".xteam-drawer{position:absolute;top:0;right:0;bottom:0;width:min(420px,92vw);display:flex;flex-direction:column;pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 16%,transparent));background:var(--dsw-specific-menu,var(--dsw-alias-bg-primary,#fff));box-shadow:var(--dsw-shadow-lv2,0 4px 20px rgba(0,0,0,.18))}",
			".xteam-panel-head{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l1,color-mix(in srgb,currentColor 10%,transparent))}",
			".xteam-live-dot{font-size:11px;opacity:.6}",
			".xteam-close{margin-left:auto;border:0;background:transparent;color:inherit;opacity:.6;font-size:14px;cursor:pointer;padding:2px 6px;border-radius:6px}",
			".xteam-close:hover{opacity:1;background:color-mix(in srgb,currentColor 8%,transparent)}",
			".xteam-panel-body{overflow:auto;padding:6px 8px 12px;flex:1}",
			// connection status + persistence badges: colored states
			".xteam-status-badges{display:inline-flex;align-items:center;gap:6px}",
			".xteam-status,.xteam-persist{display:inline-flex;align-items:center;gap:5px;padding:0 8px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:999px;font-size:11px;white-space:nowrap;line-height:18px;color:var(--dsw-alias-label-secondary,inherit)}",
			".xteam-status::before{content:\"●\";font-size:8px;line-height:1}",
			".xteam-st-connecting{color:var(--dsw-alias-label-tertiary,inherit)}",
			".xteam-st-connecting::before{color:var(--dsw-alias-label-tertiary,inherit)}",
			".xteam-st-live{color:#2e9e5b}",
			".xteam-st-live::before{color:#2e9e5b}",
			".xteam-st-reconnecting{color:#b58a2a}",
			".xteam-st-reconnecting::before{color:#b58a2a}",
			".xteam-st-polling{color:#3b7dd8}",
			".xteam-st-polling::before{color:#3b7dd8}",
			".xteam-persist-persisted{color:#2e9e5b}",
			".xteam-persist-memory{color:var(--dsw-alias-label-tertiary,inherit);border-style:dashed}",
			// timeline
			".xteam-timeline{display:flex;flex-direction:column;gap:0}",
			".xteam-tl-item{display:flex;gap:8px;padding:5px 2px;border-bottom:1px solid color-mix(in srgb,currentColor 6%,transparent)}",
			".xteam-tl-time{flex:none;font-size:10px;line-height:18px;color:var(--dsw-alias-label-tertiary,inherit);font-variant-numeric:tabular-nums;width:52px}",
			".xteam-tl-main{min-width:0;flex:1}",
			".xteam-tl-type{display:inline-block;font-size:10px;line-height:16px;padding:0 5px;border-radius:3px;background:color-mix(in srgb,currentColor 8%,transparent);color:var(--dsw-alias-label-secondary,inherit);margin-right:6px}",
			".xteam-tl-actor{font-weight:600;font-size:11px;color:var(--dsw-alias-label-primary,inherit)}",
			".xteam-tl-detail{font-size:11px;opacity:.75;word-break:break-word;margin-top:1px}",
			// agent brief (startup prompt) view
			".xteam-brief{white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.6;border-top:1px dashed color-mix(in srgb,currentColor 16%,transparent);padding-top:6px;margin-top:2px;opacity:.9}",
			// task-card detail expand/collapse
			".xteam-card-btn{align-self:flex-start;border:1px solid var(--dsw-alias-border-l1,color-mix(in srgb,currentColor 12%,transparent));background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:inherit;font-size:11px;padding:1px 8px;border-radius:4px;cursor:pointer;opacity:.8}",
			".xteam-card-btn:hover{opacity:1;background:color-mix(in srgb,currentColor 6%,transparent)}",
			".xteam-detail{display:flex;flex-direction:column;gap:8px;border-top:1px dashed color-mix(in srgb,currentColor 16%,transparent);padding-top:6px}",
			".xteam-detail-block[data-full]{white-space:pre-wrap;word-break:break-word}",
			".xteam-detail-block ul{margin:0;padding-left:16px}",
			".xteam-detail-block .dt-label{opacity:.6}"
		].join("\n");

		const STATUS_META = {
			open: { label: "待处理", cls: "st-open" },
			review: { label: "评审中", cls: "st-review" },
			rework: { label: "需返工", cls: "st-rework" },
			verified: { label: "已验证", cls: "st-verified" },
			cancelled: { label: "已取消", cls: "st-muted" }
		};
		const VERDICT_META = {
			approve: { icon: "✓", cls: "vd-approve", label: "通过" },
			reject: { icon: "✕", cls: "vd-reject", label: "否决" },
			needs_changes: { icon: "↺", cls: "vd-changes", label: "需修改" },
			pending: { icon: "○", cls: "vd-pending", label: "待评审" }
		};
		const BOARD_ORDER = ["review", "rework", "open", "verified", "cancelled"];

		/** 时间线事件类型 → 中文标签。 */
		const EVENT_TYPE_META = {
			agent_created: "创建专家",
			agent_removed: "移除专家",
			task_opened: "委派任务",
			result_submitted: "提交成果",
			review_requested: "指派评审",
			review_submitted: "登记评审",
			task_verified: "验证通过",
			task_rework: "退回返工",
			subagent_done: "子代理完成"
		};

		function formatTime(iso) {
			try {
				const d = new Date(iso);
				if (Number.isNaN(d.getTime())) return "—";
				const p = (n) => String(n).padStart(2, "0");
				return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
			} catch { return "—"; }
		}

		function truncate(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + "…" : s; }

		function isSnapshot(v) {
			return v !== null && typeof v === "object" && !Array.isArray(v)
				&& Array.isArray(v.agents) && Array.isArray(v.tasks)
				&& v.summary !== null && typeof v.summary === "object";
		}

		// ------------------------------------------------------------------
		// Live data store: one ref-counted channel (SSE + JSON fallback).
		// ------------------------------------------------------------------
		const teamStore = (() => {
			// Connection state machine:
			//   idle (no subscriber) -> connecting (channel opening) -> live
			//   (SSE open) / reconnecting (SSE onerror, auto-reconnect by
			//   EventSource) / polling (no EventSource -> JSON fallback).
			// Persists across refs: keep last non-idle on repeated open/close.
			let status = "idle";
			let snap = null;
			let seenVersion = -1;
			let es = null;
			let pollTimer = null;
			let refs = 0;
			const listeners = new Set();
			const statusListeners = new Set();

			const emit = () => {
				for (const fn of listeners) { try { fn(); } catch { /* noop */ } }
			};

			const emitStatus = (next) => {
				if (status === next) return;
				status = next;
				for (const fn of statusListeners) { try { fn(status); } catch { /* noop */ } }
			};

			function apply(next) {
				if (!isSnapshot(next)) return;
				if (typeof next.version === "number") {
					if (next.version <= seenVersion) return; // stale/duplicate
					seenVersion = next.version;
				}
				snap = next;
				emit();
			}

			function pull() {
				try {
					fetch("/api/expert-team/state", { cache: "no-store" })
						.then((res) => (res.ok ? res.json() : null))
						.then((data) => { if (data) apply(data); })
						.catch(() => { /* offline; SSE will recover */ });
				} catch { /* fetch unavailable */ }
			}

			function start() {
				emitStatus("connecting");
				pull();
				if (typeof EventSource !== "undefined") {
					es = new EventSource("/api/expert-team/events");
					es.addEventListener("open", () => { seenVersion = -1; emitStatus("live"); });
					es.addEventListener("snapshot", (event) => {
						try { apply(JSON.parse(event.data)); } catch { /* malformed frame */ }
					});
					// EventSource reconnects automatically; mark reconnecting and
					// pull() keeps the board fresh while the channel recovers.
					es.onerror = () => { emitStatus("reconnecting"); pull(); };
				} else {
					emitStatus("polling");
					pollTimer = setInterval(pull, 3000);
				}
			}

			function stop() {
				if (es) { es.close(); es = null; }
				if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
				emitStatus("idle");
			}

			return {
				subscribe(fn) {
					listeners.add(fn);
					refs += 1;
					if (refs === 1) start();
					return () => {
						listeners.delete(fn);
						refs -= 1;
						if (refs <= 0) { refs = 0; stop(); }
					};
				},
				get() { return snap; },
				subscribeStatus(fn) {
					statusListeners.add(fn);
					return () => statusListeners.delete(fn);
				},
				getStatus() { return status; }
			};
		})();

		const CONN_STATUS_META = {
			idle: { label: "未连接", cls: "xteam-st-connecting" },
			connecting: { label: "连接中", cls: "xteam-st-connecting" },
			live: { label: "实时", cls: "xteam-st-live" },
			reconnecting: { label: "重连中", cls: "xteam-st-reconnecting" },
			polling: { label: "轮询", cls: "xteam-st-polling" }
		};

		function useTeamSnapshot() {
			const [snap, setSnap] = react.useState(teamStore.get());
			react.useEffect(() => teamStore.subscribe(() => setSnap(teamStore.get())), []);
			return snap;
		}

		function useTeamStatus() {
			const [status, setStatus] = react.useState(teamStore.getStatus());
			react.useEffect(() => teamStore.subscribeStatus(setStatus), []);
			return status;
		}

		// ------------------------------------------------------------------
		// Panel open/close state shared by the header button and the overlay.
		// ------------------------------------------------------------------
		const panelState = (() => {
			let open = false;
			const listeners = new Set();
			return {
				isOpen: () => open,
				set(next) {
					const v = Boolean(next);
					if (open === v) return;
					open = v;
					for (const fn of listeners) { try { fn(); } catch { /* noop */ } }
				},
				toggle() { this.set(!open); },
				subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
			};
		})();

		function usePanelOpen() {
			const [open, setOpen] = react.useState(panelState.isOpen());
			react.useEffect(() => panelState.subscribe(() => setOpen(panelState.isOpen())), []);
			return open;
		}

		/** One board task card with a per-card expand/collapse detail view. */
		function TaskCard({ t }) {
			const e = react.createElement;
			const [open, setOpen] = react.useState(false);
			const meta = STATUS_META[t.status] || { label: t.status, cls: "st-muted" };
			const done = (t.reviews || []).filter((r) => r.verdict !== "pending").length;
			const reviews = t.reviews || [];
			const rework = t.reworkFindings || [];

			// Collapsed summary keeps the existing truncation behaviour.
			const summaryBlock = t.result
				? e("div", { className: "xteam-hint" }, "交付摘要：" + truncate(t.result.summary, 120))
				: null;

			const reviewsChips = reviews.length
				? e("div", { className: "xteam-row" }, reviews.map((r) => {
					const vm = VERDICT_META[r.verdict] || VERDICT_META.pending;
					return e("span", { className: "xteam-chip " + vm.cls, key: r.reviewerId, title: r.findings || vm.label }, r.reviewerName + " " + vm.icon);
				}))
				: null;

			const progress = reviews.length
				? e("div", { className: "xteam-stats" }, "交叉验证进度 " + done + "/" + reviews.length)
				: null;

			const reworkChips = rework.length
				? e("ul", { className: "xteam-findings" }, rework.map((f) => e("li", { key: f }, truncate(f, 120))))
				: null;

			// ---- expanded detail (full text, never truncated) ----
			let detail = null;
			if (open) {
				const blocks = [];
				if (t.objective) {
					blocks.push(e("div", { className: "xteam-detail-block", "data-full": true, key: "objective" },
						e("div", { className: "dt-label" }, "objective"),
						e("div", null, t.objective)));
				}
				if (t.result && t.result.summary) {
					blocks.push(e("div", { className: "xteam-detail-block", "data-full": true, key: "summary" },
						e("div", { className: "dt-label" }, "交付摘要"),
						e("div", null, t.result.summary)));
				}
				if (rework.length) {
					blocks.push(e("div", { className: "xteam-detail-block", "data-full": true, key: "rework" },
						e("div", { className: "dt-label" }, "返工问题清单"),
						e("ul", null, rework.map((f, i) => e("li", { key: i }, f)))));
				}
				if (reviews.length) {
					blocks.push(e("div", { className: "xteam-detail-block block-findings", "data-full": true, key: "findings" },
						e("div", { className: "dt-label" }, "评审 findings"),
						e("ul", null, reviews.map((r) => {
							const vm = VERDICT_META[r.verdict] || VERDICT_META.pending;
							const findTxt = r.findings || "（无 findings）";
							return e("li", { key: r.reviewerId },
								vm.icon + " " + r.reviewerName + "（" + vm.label + "）: " + findTxt);
						}))));
				}
				if (!blocks.length) {
					blocks.push(e("div", { className: "xteam-detail-block", key: "empty" }, "该任务暂无展开详情。"));
				}
				detail = e("div", { className: "xteam-detail" }, blocks);
			}

			return e("div", { className: "xteam-card", key: t.id },
				e("div", { className: "xteam-card-head" },
					e("span", { className: "xteam-name" }, truncate(t.title, 24)),
					e("span", { style: { marginLeft: "auto" } }, e("span", { className: "xteam-chip " + meta.cls }, meta.label))),
				e("div", { className: "xteam-meta" }, t.id + " · 负责人 " + t.ownerName + (t.revision > 0 ? " · 第 " + t.revision + " 版" : "") + ((t.dependsOn || []).length ? " · 依赖 " + t.dependsOn.join("、") : "")),
				e("ul", { className: "xteam-crit" }, (t.acceptanceCriteria || []).map((c) => e("li", { key: c }, truncate(c, 80)))),
				summaryBlock,
				reviewsChips,
				progress,
				reworkChips,
				e("button", { type: "button", className: "xteam-card-btn", onClick: () => setOpen(!open), "aria-expanded": open }, open ? "收起详情" : "展开详情"),
				detail);
		}

		/** 团队页专家卡：角色信息 + token 统计 + 启动提示词（brief）展开查看。 */
		function AgentCard({ a, openOf }) {
			const e = react.createElement;
			const [showBrief, setShowBrief] = react.useState(false);
			const tok = a.tokens || { in: 0, out: 0 };
			return e("div", { className: "xteam-card", key: a.id },
				e("div", { className: "xteam-card-head" },
					e("div", { className: "xteam-avatar" }, String(a.name).slice(0, 1)),
					e("div", null,
						e("div", { className: "xteam-name" }, a.name),
						e("div", { className: "xteam-role" }, a.role + " · " + a.id)),
					e("span", { style: { marginLeft: "auto" } }, e("span", { className: "xteam-chip st-muted" }, "在办 " + (openOf[a.id] || 0)))),
				e("div", { className: "xteam-row" }, (a.expertise || []).map((x) => e("span", { className: "xteam-tag", key: x }, x))),
				e("ul", { className: "xteam-duties" }, (a.responsibilities || []).map((r) => e("li", { key: r }, r))),
				e("div", { className: "xteam-stats" }, "输入 " + tok.in + " / 输出 " + tok.out + " tokens · 累计交付 " + ((a.stats && a.stats.delivered) || 0) + " · 完成评审 " + ((a.stats && a.stats.reviews) || 0)),
				showBrief ? e("div", { className: "xteam-brief" }, a.brief || "（无简报）") : null,
				a.brief ? e("button", { type: "button", className: "xteam-card-btn", onClick: () => setShowBrief(!showBrief), "aria-expanded": showBrief }, showBrief ? "收起提示词" : "查看提示词") : null);
		}

		function Dashboard({ snap }) {
			const [tab, setTab] = react.useState("team");
			const e = react.createElement;
			const chip = (cls, text) => e("span", { className: "xteam-chip " + cls }, text);
			const emptyHint = (text) => e("div", { className: "xteam-empty" }, text);
			const summary = snap.summary;

			const tabBtn = (id, label) => e("button", { type: "button", className: "xteam-tab" + (tab === id ? " active" : ""), onClick: () => setTab(id) }, label);
			const head = e("div", { className: "xteam-head" },
				e("span", { className: "xteam-title" }, "专家团 Expert Team"),
				chip("st-muted", summary.agents + " 名专家 · " + summary.tasks + " 项任务"),
				chip("st-review", "评审中 " + summary.review),
				chip("st-rework", "返工 " + summary.rework),
				chip("st-verified", "已验证 " + summary.verified),
				e("span", { className: "xteam-tabs" }, tabBtn("team", "团队分工"), tabBtn("board", "任务看板"), tabBtn("matrix", "交叉验证"), tabBtn("timeline", "时间线")));

			let body;
			if (tab === "team") {
				if (!snap.agents.length) body = emptyHint("还没有专家。调用 experts_create_agent 创建第一批专家（角色、专长、职责边界）。");
				else {
					const openOf = {};
					for (const t of snap.tasks) if (t.status === "open" || t.status === "review" || t.status === "rework") openOf[t.ownerId] = (openOf[t.ownerId] || 0) + 1;
					body = e("div", { className: "xteam-grid" }, snap.agents.map((a) => e(AgentCard, { a: a, openOf: openOf, key: a.id })));
				}
			} else if (tab === "board") {
				if (!snap.tasks.length) body = emptyHint("还没有任务。调用 experts_open_task 为专家委派任务（目标 + 验收标准）。");
				else {
					body = e("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, BOARD_ORDER.map((status) => {
						const list = snap.tasks.filter((t) => t.status === status);
						if (!list.length) return null;
						return e("div", { key: status },
							e("div", { className: "xteam-section-title" }, STATUS_META[status].label + "（" + list.length + "）"),
							e("div", { className: "xteam-grid" }, list.map((t) => e(TaskCard, { t: t, key: t.id }))));
					}));
				}
			} else if (tab === "matrix") {
				if (!snap.tasks.length || !snap.agents.length) body = emptyHint("先创建专家并委派任务，这里会显示任务 × 专家的交叉验证矩阵。");
				else {
					body = e("div", null,
						e("table", { className: "xteam-table" },
							e("thead", null, e("tr", null,
								e("th", null, "任务"),
								snap.agents.map((a) => e("th", { key: a.id, title: a.name + "（" + a.role + "）" }, truncate(a.name, 8))))),
							e("tbody", null, snap.tasks.map((t) => e("tr", { key: t.id },
								e("td", null, t.id + " " + truncate(t.title, 18)),
								snap.agents.map((a) => {
									if (a.id === t.ownerId) return e("td", { key: a.id }, e("span", { className: "xteam-owner", title: "负责人" }, "◆"));
									const r = (t.reviews || []).find((x) => x.reviewerId === a.id);
									if (!r) return e("td", { key: a.id, className: "vd-pending" }, "·");
									const m = VERDICT_META[r.verdict] || VERDICT_META.pending;
									return e("td", { key: a.id, title: r.findings || m.label }, e("span", { className: m.cls }, m.icon));
								}))))),
						e("div", { className: "xteam-hint", style: { marginTop: 6 } }, "◆ 负责人 · ✓ 通过 · ✕ 否决 · ↺ 需修改 · ○ 待评审。任务需全体评审通过才算验证完成。"));
				}
			} else {
				// timeline: agent interaction events, newest first
				const evs = snap.events || [];
				if (!evs.length) body = emptyHint("还没有协作事件。创建专家、委派任务、评审后这里会形成时间线。");
				else {
					body = e("div", { className: "xteam-timeline" }, evs.slice().reverse().map((ev) => {
						const tlabel = EVENT_TYPE_META[ev.type] || ev.type;
						const taskRef = ev.taskId ? " · " + ev.taskId : "";
						return e("div", { className: "xteam-tl-item", key: ev.id },
							e("span", { className: "xteam-tl-time" }, formatTime(ev.at)),
							e("div", { className: "xteam-tl-main" },
								e("span", { className: "xteam-tl-type" }, tlabel),
								e("span", { className: "xteam-tl-actor" }, ev.actorName + taskRef),
								ev.detail ? e("div", { className: "xteam-tl-detail" }, ev.detail) : null));
					}));
				}
			}

			return e("div", { className: "xteam-root" },
				head,
				body,
				e("div", { className: "xteam-hint" }, "工作流：experts_plan_team 配比（大公司岗位结构，含辅助岗）→ experts_create_agent 组队 → experts_open_task 委派 → subagent 执行 → experts_submit_result 交付 → experts_request_review 交叉验证 → experts_submit_review 登记结论；全员通过即 verified。"));
		}

		/** Keyed toolview row for experts_status. */
		function ExpertsStatusRow(props) {
			const e = react.createElement;
			const block = props.block;
			try {
				if (!block || !("kind" in block)) {
					return e("div", { className: "xteam-root" }, e("div", { className: "xteam-empty" }, "正在生成专家团快照…"));
				}
				if (block.isError) {
					const text = (block.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
					return e("div", { className: "xteam-root" }, e("div", { className: "xteam-fallback" }, text || "调用失败"));
				}
				const meta = block.meta;
				if (!isSnapshot(meta)) {
					const text = (block.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
					return e("div", { className: "xteam-root" }, e("div", { className: "xteam-fallback" }, text || "（无快照数据）"));
				}
				return e(Dashboard, { snap: meta });
			} catch (error) {
				return e("div", { className: "xteam-root" }, e("div", { className: "xteam-empty" }, "专家团仪表盘渲染失败：" + String(error && error.message || error)));
			}
		}

		/** Session-header action: toggles the floating panel; live active-task badge. */
		function ExpertsPanelAction() {
			const e = react.createElement;
			const snap = useTeamSnapshot();
			const open = usePanelOpen();
			const s = snap && snap.summary;
			const active = s ? (s.open || 0) + (s.review || 0) + (s.rework || 0) : 0;
			return e("button", {
				type: "button",
				className: "xteam-hbtn" + (open ? " xteam-hbtn-active" : ""),
				title: "专家团面板（实时）",
				"aria-expanded": open,
				"aria-label": "专家团面板" + (active > 0 ? "，" + active + " 项任务进行中" : ""),
				onClick: () => panelState.toggle()
			},
				e("span", null, "👥 专家团"),
				active > 0 ? e("span", { className: "xteam-hbtn-badge" }, String(active)) : null);
		}

		/** shell.overlay entry: renders nothing until opened. */
		function ExpertsOverlayEntry() {
			const open = usePanelOpen();
			if (!open) return null;
			return react.createElement(ExpertsPanel, null);
		}

		function ExpertsPanel() {
			const e = react.createElement;
			const snap = useTeamSnapshot();
			const connStatus = useTeamStatus();
			const connMeta = CONN_STATUS_META[connStatus] || CONN_STATUS_META.idle;
			// persisted === true -> persisted on disk; false / undefined -> in-memory.
			const persisted = snap && snap.persisted === true;
			const persistBadge = snap
				? e("span", { className: "xteam-persist " + (persisted ? "xteam-persist-persisted" : "xteam-persist-memory") }, persisted ? "已持久化" : "内存模式")
				: null;
			react.useEffect(() => {
				const onKey = (ev) => { if (ev.key === "Escape") panelState.set(false); };
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, []);
			return e("div", { className: "xteam-overlay" },
				e("div", { className: "xteam-drawer", role: "dialog", "aria-label": "专家团" },
					e("div", { className: "xteam-panel-head" },
						e("span", { className: "xteam-title" }, "专家团"),
						e("span", { className: "xteam-status-badges" },
							e("span", { className: "xteam-status " + connMeta.cls, title: "数据通道：" + connMeta.label }, connMeta.label),
							persistBadge),
						e("button", { type: "button", className: "xteam-close", "aria-label": "关闭", onClick: () => panelState.set(false) }, "✕")),
					e("div", { className: "xteam-panel-body" },
						snap ? e(Dashboard, { snap }) : e("div", { className: "xteam-empty" }, "正在连接专家团数据…"))));
		}

		const inject = ["slots"];
		function apply(ctx) {
			ctx.effect(() => {
				if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
				const style = document.createElement("style");
				style.id = STYLE_ID;
				style.textContent = CSS;
				document.head.appendChild(style);
				return () => { style.remove(); };
			}, "expert-team: styles");
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "experts_status"
			}, ExpertsStatusRow));
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "experts-panel",
				order: 30
			}, ExpertsPanelAction));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "experts-panel"
			}, ExpertsOverlayEntry));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
