import { defineTool } from "@deepseek-ai/dsh-tools";
import { existsSync, mkdirSync, readFileSync, promises as fsp } from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Expert Team (专家团) — host half.
 *
 * Qoder-style expert-team orchestration as model tools: create role-bounded
 * experts, dispatch tasks with acceptance criteria, submit deliverables, and
 * cross-validate each deliverable through independent peer reviewers. A task
 * settles `verified` only when every assigned reviewer approves; any other
 * verdict returns it to `rework` with a consolidated findings list.
 *
 * Mounted once by the host-composition `ui-expert-team` row (see this
 * package's cordis.patch.yml): `ctx.tools.register` from this unscoped
 * context files every tool into the registry's GLOBAL layer, so every
 * session of every preset sees the same shared team state.
 *
 * Live UI data: the same closure also drives two `webServer` routes —
 * GET /api/expert-team/state (JSON snapshot, cache: no-store) and
 * GET /api/expert-team/events (SSE: full snapshot on connect, then a
 * `snapshot` event on every mutation). The browser half's floating panel
 * consumes them. `webServer` is declared in `inject` (the official
 * cross-row contract, as dsh-client-hmr does) so the loader provides it
 * onto this row's context before `apply` runs; the optional `ctx.get`
 * guard keeps a hypothetical non-web mount from throwing.
 *
 * Persistence: team state (agents/tasks/agentSeq/taskSeq/version) is written
 * to a JSON archive on every mutation and reloaded on startup so the shared
 * team state survives a DSH restart. Save failures degrade silently to
 * in-memory mode (never block a tool call). The archive path is derived from
 * DSH_HOME or the user home directory — never a hard-coded absolute path.
 */
const inject = ["tools", "webServer"];

/**
 * 大公司人员配比模板（experts_plan_team 的数据源）。
 *
 * 组队原则（写进工具描述，agent 组队时必须遵守）：
 * - 参照大公司人员结构配比，岗位职责相互独立、避免重叠；
 * - 设计类任务（软件 UI/视觉/交互/版式）必须增加美术设计等设计岗；
 * - 团队尽可能配备一名辅助型岗位（产品经理 / 协调员 / 文档专员）。
 *
 * kind: core=核心岗 · design=设计岗 · auxiliary=辅助岗。
 * name 为示例代号，创建时可替换为实际姓名。
 */
const ROSTER_TEMPLATES = {
	"software-design": {
		label: "软件设计（含美术设计岗）",
		note: "参照大公司软件产品团队：产品经理牵头协调，架构/前后端/美术/测试岗位独立、职责互不重叠。",
		team: [
			{ name: "产品经理-周", role: "产品经理", kind: "auxiliary", expertise: ["需求分析", "范围与优先级管理", "验收标准设计"], responsibilities: ["澄清需求并输出需求文档", "拆解任务并协调各岗位进度", "组织验收与问题汇总"] },
			{ name: "系统架构师-陈", role: "系统架构师", kind: "core", expertise: ["总体架构设计", "技术选型", "接口设计"], responsibilities: ["总体架构与技术选型", "定义模块边界与接口契约"] },
			{ name: "美术设计-林", role: "美术设计（UI/UX）", kind: "design", expertise: ["UI 设计", "交互设计", "视觉规范"], responsibilities: ["界面视觉与交互设计", "输出设计规范与切图标注"] },
			{ name: "前端工程师-吴", role: "前端工程师", kind: "core", expertise: ["前端框架", "界面实现", "动效"], responsibilities: ["按设计稿实现界面", "前端交互与状态管理"] },
			{ name: "后端工程师-郑", role: "后端工程师", kind: "core", expertise: ["后端服务", "数据建模", "API"], responsibilities: ["后端服务与数据模型", "实现并维护 API"] },
			{ name: "测试工程师-王", role: "测试工程师", kind: "core", expertise: ["测试用例设计", "功能与回归测试"], responsibilities: ["设计并执行测试用例", "独立交叉验证他人交付"] }
		]
	},
	"software-dev": {
		label: "软件开发",
		note: "参照大公司研发团队：产品经理辅助协调，架构/前端/后端/测试/运维各司其职。",
		team: [
			{ name: "产品经理-周", role: "产品经理", kind: "auxiliary", expertise: ["需求分析", "任务拆解", "验收协调"], responsibilities: ["需求澄清与范围控制", "协调进度与验收组织"] },
			{ name: "系统架构师-陈", role: "系统架构师", kind: "core", expertise: ["架构设计", "技术选型"], responsibilities: ["总体架构与技术决策", "模块边界与接口定义"] },
			{ name: "前端工程师-吴", role: "前端工程师", kind: "core", expertise: ["前端实现", "交互"], responsibilities: ["前端功能实现与联调"] },
			{ name: "后端工程师-郑", role: "后端工程师", kind: "core", expertise: ["后端实现", "数据建模"], responsibilities: ["后端功能实现与联调"] },
			{ name: "测试工程师-王", role: "测试工程师", kind: "core", expertise: ["用例设计", "回归测试"], responsibilities: ["测试用例与执行", "独立交叉验证他人交付"] },
			{ name: "运维工程师-冯", role: "运维/DevOps 工程师", kind: "core", expertise: ["部署", "监控", "CI/CD"], responsibilities: ["部署与发布流程", "环境与监控保障"] }
		]
	},
	"data-algorithm": {
		label: "数据与算法",
		note: "参照大公司数据团队：协调员辅助统筹，数据/算法/验证岗位独立。",
		team: [
			{ name: "项目协调员-许", role: "项目协调员", kind: "auxiliary", expertise: ["进度管理", "数据资产梳理", "报告组织"], responsibilities: ["任务进度跟踪与协调", "实验记录与报告汇总"] },
			{ name: "数据工程师-孙", role: "数据工程师", kind: "core", expertise: ["数据采集", "数据清洗", "特征工程"], responsibilities: ["数据管道与特征构建"] },
			{ name: "算法工程师-赵", role: "算法工程师", kind: "core", expertise: ["算法建模", "模型训练", "效果评估"], responsibilities: ["模型方案设计与实现", "评估指标与结论"] },
			{ name: "验证工程师-钱", role: "验证工程师", kind: "core", expertise: ["基准测试", "消融实验", "数据验证"], responsibilities: ["独立复现与验证结论", "交叉验证他人交付"] }
		]
	},
	"content": {
		label: "内容创作",
		note: "参照大公司内容团队：策划/撰稿/编辑/校对岗位独立，美术负责配图，资料助理辅助。",
		team: [
			{ name: "主编策划-周", role: "主编/策划", kind: "core", expertise: ["选题策划", "内容结构", "受众分析"], responsibilities: ["选题与内容大纲", "终审把关"] },
			{ name: "撰稿人-吴", role: "撰稿人", kind: "core", expertise: ["写作", "资料调研"], responsibilities: ["按大纲完成稿件"] },
			{ name: "编辑-郑", role: "编辑", kind: "core", expertise: ["润色", "事实核查"], responsibilities: ["稿件润色与事实核查"] },
			{ name: "校对-王", role: "校对", kind: "core", expertise: ["文字校对", "格式规范"], responsibilities: ["错漏校对与格式统一"] },
			{ name: "美术设计-林", role: "美术设计", kind: "design", expertise: ["配图", "版式设计"], responsibilities: ["配图与版式设计"] },
			{ name: "资料助理-许", role: "资料助理", kind: "auxiliary", expertise: ["资料收集", "引用整理"], responsibilities: ["资料收集整理", "引用与素材归档"] }
		]
	}
};

/** 通用配比：未匹配领域时的兜底方案（agent 应按任务再微调）。 */
const GENERAL_ROSTER = {
	label: "通用（按任务微调）",
	note: "按任务规模取 3~6 岗；岗位职责必须相互独立；涉及视觉/界面/产品形态时增设美术设计岗；必须保留一名辅助岗。",
	team: [
		{ name: "项目协调员-许", role: "项目协调员", kind: "auxiliary", expertise: ["进度协调", "记录整理", "验收组织"], responsibilities: ["任务进度跟踪与跨岗协调", "过程记录与资料整理", "组织验收与问题汇总"] },
		{ name: "主责专家-陈", role: "领域主责专家", kind: "core", expertise: ["领域核心技能"], responsibilities: ["负责核心交付物与方案决策"] },
		{ name: "副责专家-吴", role: "领域互补专家", kind: "core", expertise: ["互补领域技能"], responsibilities: ["承担互补环节，不越主责边界"] },
		{ name: "验证专家-王", role: "验证专家", kind: "core", expertise: ["独立复核", "标准核对"], responsibilities: ["独立交叉验证他人交付", "逐条核对验收标准"] },
		{ name: "美术设计-林", role: "美术设计（按需增设）", kind: "design", expertise: ["视觉设计", "交互/版式"], responsibilities: ["任务涉及视觉/界面时负责设计产出"] }
	]
};

/**
 * 持久化模块：专家团状态（agents / tasks / agentSeq / taskSeq / version）
 * 写入磁盘 JSON，启动时加载恢复，变更后异步保存。
 *
 * - 存档路径由 DSH_HOME 或用户主目录推导 → <DSH_HOME>/storages/expert-team/team.json，
 *   与 DSH 自身存储布局一致，禁止硬编码任何本机绝对路径。
 * - 保存采用串行化写盘：pending 标志 + 最后一次变更再写（last-write-wins），
 *   避免并发写竞争（同一时刻最多一个写操作在途）。
 * - 写盘失败（父目录 ENOENT / 权限 EACCES / 磁盘错误）静默降级为内存模式：
 *   不抛出、不阻断工具调用，快照 persisted 字段置 false；加载存档成功或
 *   写盘成功时为 true。
 */

/** 推导存档绝对路径（导出供冒烟测试校验；测试可注入 DSH_HOME 隔离）。 */
function resolveStorePath() {
	const base = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
	return path.join(base, "storages", "expert-team", "team.json");
}

/** 启动时读取存档；不存在或损坏（JSON 非法 / 结构不符）返回 null，不崩溃。 */
function loadArchive(filePath) {
	try {
		if (!existsSync(filePath)) return null;
		return JSON.parse(readFileSync(filePath, "utf8"));
	} catch {
		return null;
	}
}

/**
 * 串行化异步写盘器：多次变更 coalesce 到最近一次内容；persisted 反映最后一次
 * 写盘结果（false = 处于内存模式）。
 */
function createSaver(filePath) {
	let pending = null;
	let writing = false;
	let lastOk = false;
	async function pump() {
		if (writing) return;
		writing = true;
		try {
			while (pending !== null) {
				const payload = pending;
				pending = null;
				try {
					await fsp.writeFile(filePath, payload, "utf8");
					lastOk = true;
				} catch {
					lastOk = false; // 降级：静默失败，维持内存模式
				}
			}
		} finally {
			writing = false;
		}
	}
	return {
		queue(json) { pending = json; pump().catch(() => {}); },
		get persisted() { return lastOk; }
	};
}

function makeTeam() {
	const agents = new Map();
	const tasks = new Map();
	let agentSeq = 0;
	let taskSeq = 0;
	let version = 0;
	let eventSeq = 0;
	/** 交互事件日志（append-only，持久化；展示各 agent 之间的协作时间线）。 */
	const events = [];
	/** 最近发起的 subagent 子会话（FIFO，用于把 token 归集到专家）。 */
	const recentStarts = [];
	/** 已解析归属、等待 subagent 结束结算的运行。 */
	const pendingRuns = [];
	const listeners = new Set();
	const TERMINAL = { verified: true, cancelled: true };

	// —— 持久化初始化：apply 启动时读取存档恢复，之后每次变更异步写盘 ——
	const storePath = resolveStorePath();
	const archive = loadArchive(storePath);
	const loadedFromArchive = archive !== null && restoreState(archive);
	// 启动时一次性创建父目录（之后每次保存直接 writeFile，避免反复 mkdir）；失败静默，交由写盘阶段兜底/降级。
	try { mkdirSync(path.dirname(storePath), { recursive: true }); } catch { /* 目录创建失败 → 后续写盘尝试失败即降级内存模式 */ }
	const saver = createSaver(storePath);

	const nowIso = () => new Date().toISOString();
	const fail = (error) => ({ ok: false, error: String(error) });

	/** 序列化当前状态为 JSON 字符串（Map 转数组，KISS：原始记录原样保存）。 */
	function serializeState() {
		return JSON.stringify({
			savedAt: nowIso(),
			agentSeq,
			taskSeq,
			version,
			eventSeq,
			events,
			agents: Array.from(agents.values()),
			tasks: Array.from(tasks.values())
		}, null, 2);
	}

	/** 逐条校验 agent 记录最小字段；brief/tokens 为扩展字段，缺省兼容旧存档。 */
	function validAgent(rec) {
		return !!rec && typeof rec.id === "string" && typeof rec.name === "string" && typeof rec.role === "string"
			&& Array.isArray(rec.expertise) && Array.isArray(rec.responsibilities)
			&& typeof rec.assigned === "number" && typeof rec.delivered === "number" && typeof rec.reviews === "number";
	}

	/** 逐条校验 task 记录最小字段；reviewers 每项须含 reviewerId（其余字段原样恢复）。 */
	function validTask(rec) {
		return !!rec && typeof rec.id === "string" && typeof rec.title === "string" && typeof rec.ownerId === "string"
			&& Array.isArray(rec.criteria) && Array.isArray(rec.dependsOn) && Array.isArray(rec.reworkFindings)
			&& Array.isArray(rec.reviewers) && rec.reviewers.every((r) => !!r && typeof r.reviewerId === "string")
			&& typeof rec.status === "string" && typeof rec.revision === "number";
	}

	/** 从存档恢复主体状态；任一记录或缺字段不合法则整体返回 false（上层视为重置，不崩溃）。 */
	function restoreState(data) {
		if (!data || typeof data !== "object") return false;
		if (!Array.isArray(data.agents) || !Array.isArray(data.tasks)) return false;
		if (!data.agents.every(validAgent) || !data.tasks.every(validTask)) return false;
		agents.clear();
		tasks.clear();
		for (const rec of data.agents) {
			// 扩展字段缺省归一（旧存档兼容）
			if (typeof rec.brief !== "string") rec.brief = null;
			if (!rec.tokens || typeof rec.tokens !== "object") rec.tokens = { in: 0, out: 0 };
			agents.set(rec.id, rec);
		}
		for (const rec of data.tasks) tasks.set(rec.id, rec);
		agentSeq = typeof data.agentSeq === "number" ? data.agentSeq : 0;
		taskSeq = typeof data.taskSeq === "number" ? data.taskSeq : 0;
		version = typeof data.version === "number" ? data.version : 0;
		eventSeq = typeof data.eventSeq === "number" ? data.eventSeq : 0;
		events.length = 0;
		if (Array.isArray(data.events)) {
			for (const ev of data.events) {
				if (ev && typeof ev === "object" && typeof ev.id === "string" && typeof ev.at === "string") {
					events.push(ev);
				}
			}
		}
		return true;
	}

	/** 变更后异步写盘（串行化控制，写盘失败静默降级）。 */
	function saveState() {
		saver.queue(serializeState());
	}

	/** 快照里展示的持久化状态：加载存档成功或最近一次写盘成功均为 true。 */
	const isPersisted = () => loadedFromArchive || saver.persisted;

	/** Broadcast a change to every subscriber (SSE fan-out). */
	function notify() {
		version += 1;
		for (const fn of listeners) {
			try { fn(); } catch { /* listener errors must not break mutations */ }
		}
		saveState();
	}

	/** 追加一条协作事件（时间线数据，随快照下发并持久化）。不自动 notify——调用方在状态变更点统一触发。 */
	function logEvent(type, actorId, taskId, detail) {
		eventSeq += 1;
		const actor = agents.get(actorId);
		events.push({
			id: "e" + eventSeq,
			at: nowIso(),
			type,
			actorId: actorId || null,
			actorName: actor ? actor.name : "(系统)",
			taskId: taskId || null,
			detail: detail || null
		});
		if (events.length > 500) events.splice(0, events.length - 500);
	}

	// —— subagent 观察：把每次 subagent 执行的真实 token 归集到对应专家 ——
	// 归属链：subagent/start(childId) 入 FIFO → tools/result(subagent 工具) 解析
	// 委派/评审简报中的任务与专家 → 与最旧 childId 配对入 pendingRuns →
	// subagent/end(childId) 结算 token 累计到该专家并记时间线事件。
	// 并行派发时按 FIFO 大概率正确；解析失败则只记无归属的时间线事件（诚实降级）。
	function observeSubagentStart(childId) {
		recentStarts.push({ childId, at: nowIso() });
		if (recentStarts.length > 50) recentStarts.shift();
	}

	function observeSubagentToolCall(promptText) {
		const text = String(promptText || "");
		const m = text.match(/\(?\s*((?:任务\s*)?t\d+)\s*\)?/);
		if (!m) return;
		const taskId = m[1].replace(/^任务\s*/, "");
		const task = tasks.get(taskId);
		if (!task) return;
		let ownerId = task.ownerId;
		// 交叉验证简报里执行者是评审专家："你是 xxx（角色）"
		if (text.includes("交叉验证") || text.includes("评审 ")) {
			const nm = text.match(/你是\s*([^（\n]+?)\s*（/);
			if (nm) {
				for (const a of agents.values()) {
					if (a.name === nm[1].trim()) { ownerId = a.id; break; }
				}
			}
		}
		const start = recentStarts.shift();
		pendingRuns.push({ childId: start ? start.childId : null, ownerId, taskId, at: nowIso() });
		if (pendingRuns.length > 50) pendingRuns.shift();
	}

	/** subagent 结束时结算：把该次运行的输入/输出 token 累计到归属专家（无归属则仅记事件）。 */
	function observeSubagentEnd(childId, tokenIn, tokenOut) {
		let run = null;
		const exact = pendingRuns.findIndex((r) => r.childId === childId);
		if (exact >= 0) run = pendingRuns.splice(exact, 1)[0];
		else if (pendingRuns.length) run = pendingRuns.shift();
		const inT = Math.max(0, Math.round(tokenIn || 0));
		const outT = Math.max(0, Math.round(tokenOut || 0));
		if (run && run.ownerId) {
			const a = agents.get(run.ownerId);
			if (a) {
				if (!a.tokens) a.tokens = { in: 0, out: 0 };
				a.tokens.in += inT;
				a.tokens.out += outT;
			}
			logEvent("subagent_done", run.ownerId, run.taskId, "输入 " + inT + " / 输出 " + outT + " tokens");
		} else {
			logEvent("subagent_done", null, null, "child " + String(childId).slice(-8) + " · 输入 " + inT + " / 输出 " + outT + " tokens（未关联专家）");
		}
		notify();
	}

	function agentView(a) {
		return {
			id: a.id,
			name: a.name,
			role: a.role,
			expertise: a.expertise.slice(),
			responsibilities: a.responsibilities.slice(),
			brief: a.brief || null,
			tokens: { in: (a.tokens && a.tokens.in) || 0, out: (a.tokens && a.tokens.out) || 0 },
			stats: { assigned: a.assigned, delivered: a.delivered, reviews: a.reviews }
		};
	}

	/** 派生：任务是否被依赖阻塞（返回未满足依赖的 id 列表，无阻塞为空数组）。
	 * 依赖任务缺失或状态非终态（非 verified/cancelled）即视为未完成 → 列入阻塞；不改变持久化结构。 */
	function blockedByFor(t) {
		return t.dependsOn.filter((id) => {
			const dep = tasks.get(id);
			return !dep || !TERMINAL[dep.status];
		});
	}

	function taskView(t) {
		const owner = agents.get(t.ownerId);
		return {
			id: t.id,
			title: t.title,
			objective: t.objective,
			ownerId: t.ownerId,
			ownerName: owner ? owner.name : "(已移除)",
			status: t.status,
			acceptanceCriteria: t.criteria.slice(),
			dependsOn: t.dependsOn.slice(),
			blockedBy: blockedByFor(t),
			revision: t.revision,
			result: t.result ? { summary: t.result.summary, at: t.result.at } : null,
			reviews: t.reviewers.map((r) => {
				const ra = agents.get(r.reviewerId);
				return { reviewerId: r.reviewerId, reviewerName: ra ? ra.name : "(已移除)", verdict: r.verdict, findings: r.findings, at: r.at };
			}),
			reworkFindings: t.reworkFindings.slice()
		};
	}

	function snapshot() {
		const agentViews = Array.from(agents.values()).map(agentView);
		const taskViews = Array.from(tasks.values()).map(taskView);
		const summary = { agents: agentViews.length, tasks: taskViews.length, open: 0, review: 0, rework: 0, verified: 0, cancelled: 0 };
		for (const t of taskViews) {
			if (Object.prototype.hasOwnProperty.call(summary, t.status)) summary[t.status] += 1;
		}
		return { agents: agentViews, tasks: taskViews, summary, events: events.slice(), version, persisted: isPersisted() };
	}

	function agentBrief(a) {
		const lines = ["# 专家档案：" + a.name, "角色：" + a.role, "专长：" + a.expertise.join("、"), "职责边界（只做这些，超出范围应拒绝并说明原因）："];
		for (const r of a.responsibilities) lines.push("- " + r);
		lines.push("工作准则：只交付职责范围内的成果；结论必须附证据与推理；不确定之处明确标注，不得臆测。");
		return lines.join("\n");
	}

	function dispatchBrief(a, t) {
		const lines = [agentBrief(a), "", "# 任务委派：" + t.title + "（" + t.id + "）", "目标：" + t.objective, "验收标准："];
		t.criteria.forEach((c, i) => lines.push(i + 1 + ". " + c));
		if (t.dependsOn.length) lines.push("依赖任务：" + t.dependsOn.join("、"));
		lines.push("交付要求：完成后输出【交付摘要】与【关键证据】，并逐条对照验收标准自检。");
		return lines.join("\n");
	}

	function reviewBrief(rv, t, ownerName) {
		const lines = [
			"# 交叉验证：评审 " + ownerName + " 的交付（任务 " + t.id + "：" + t.title + "）",
			"你是 " + rv.name + "（" + rv.role + "）。请独立复核下面的交付内容，不要默认它正确。",
			"验收标准："
		];
		t.criteria.forEach((c, i) => lines.push(i + 1 + ". " + c));
		lines.push("", "待验证的交付（第 " + t.revision + " 版）：", t.result ? t.result.summary : "（无）", "", "输出：结论（approve / reject / needs_changes）+ 逐条核对结果 + 发现的问题与证据。");
		return lines.join("\n");
	}

	const txt = (text) => [{ type: "text", text: String(text) }];

	function renderStatus(v) {
		const s = v.summary;
		const lines = ["专家团总览：" + s.agents + " 名专家｜任务 " + s.tasks + " 项（待处理 " + s.open + " · 评审中 " + s.review + " · 返工 " + s.rework + " · 已验证 " + s.verified + "）"];
		if (v.agents.length) {
			const openOf = {};
			for (const t of v.tasks) if (t.status === "open" || t.status === "review" || t.status === "rework") openOf[t.ownerId] = (openOf[t.ownerId] || 0) + 1;
			lines.push("专家分工：");
			for (const a of v.agents) lines.push("- " + a.id + " " + a.name + "（" + a.role + "）：在办 " + (openOf[a.id] || 0) + " · 累计交付 " + a.stats.delivered + " · 完成评审 " + a.stats.reviews + "；职责：" + a.responsibilities.join("、"));
		}
		if (v.tasks.length) {
			lines.push("任务看板：");
			for (const t of v.tasks) {
				const stated = t.reviews.filter((r) => r.verdict !== "pending").length;
				let line = "- " + t.id + " " + t.title + "｜负责人 " + t.ownerName + "｜状态 " + t.status;
				if (t.reviews.length) line += "｜评审表态 " + stated + "/" + t.reviews.length + "（" + t.reviews.map((r) => r.reviewerName + ":" + r.verdict).join("，") + "）";
				if (t.status === "rework" && t.reworkFindings.length) line += "｜待解决问题 " + t.reworkFindings.length + " 条";
				if (t.blockedBy && t.blockedBy.length) line += "｜依赖阻塞：" + t.blockedBy.join("、") + " 未完成";
				lines.push(line);
			}
		}
		lines.push("流程：experts_plan_team 配比（大公司岗位结构，含辅助岗）→ experts_create_agent 组队 → experts_open_task 委派 → subagent 执行 → experts_submit_result 交付 → experts_request_review 指派交叉验证 → experts_submit_review 登记结论；全员通过=verified，否则 rework 返工后重新提交。");
		return txt(lines.join("\n"));
	}

	const toolDefs = [
		{
			name: "experts_plan_team",
			description: "专家团：按大公司人员配比生成团队岗位方案（组队第一步）。参照大公司人员结构：岗位职责相互独立、避免重叠；设计类任务（软件 UI/视觉/交互/版式）必须包含美术设计等设计岗；尽可能配备一名辅助型岗位（产品经理/协调员/文档专员）。输入任务概述与可选领域，返回岗位清单（含示例代号、角色、专长、职责边界、岗位类型）；随后用 experts_create_agent 逐岗创建。",
			parameters: {
				task: { type: "string", description: "任务概述：要完成的最终目标（决定团队规模与岗位构成）", required: true },
				domain: { type: "string", description: "领域（可选）：software-design 软件设计 / software-dev 软件开发 / data-algorithm 数据与算法 / content 内容创作；缺省按任务推断" }
			},
			output: {
				schema: { type: "json" },
				render(args, value) {
					if (!value.ok) return txt("❌ 生成配比失败：" + value.error);
					const kindLabel = { core: "核心", design: "设计", auxiliary: "辅助" };
					const lines = [
						"🏢 推荐团队配比（参照大公司人员结构）· " + value.domainLabel,
						"任务：" + String(args.task || ""),
						"配比说明：" + value.note,
						""
					];
					value.team.forEach((m, i) => {
						lines.push((i + 1) + ". " + m.name + "｜" + m.role + "（" + kindLabel[m.kind] + "岗）");
						lines.push("   专长：" + m.expertise.join("、"));
						lines.push("   职责边界：" + m.responsibilities.join("；"));
					});
					lines.push("", "下一步：按上面岗位逐个调用 experts_create_agent（name/role/expertise/responsibilities 照填）创建专家，再 experts_open_task 委派。");
					return txt(lines.join("\n"));
				}
			},
			execute: async (args) => {
				const task = String(args.task || "").trim();
				if (!task) return fail("task 不能为空");
				const domain = String(args.domain || "").trim().toLowerCase();
				const tpl = ROSTER_TEMPLATES[domain] || null;
				const selected = tpl || GENERAL_ROSTER;
				return {
					ok: true,
					domain: domain || "general",
					domainLabel: selected.label,
					note: selected.note,
					team: selected.team.map((m) => ({ name: m.name, role: m.role, kind: m.kind, expertise: m.expertise.slice(), responsibilities: m.responsibilities.slice() }))
				};
			}
		},
		{
			name: "experts_create_agent",
			description: "专家团：创建一名职责明确的专家 agent。提供姓名/代号、角色、专长领域、职责边界。组队原则：参照大公司人员配比，岗位职责相互独立、避免重叠；设计类任务（软件 UI/视觉/交互/版式）应增加美术设计等设计岗；团队尽可能配备一名辅助型岗位（产品经理/协调员/文档专员）。建议先调用 experts_plan_team 生成配比方案，再逐岗创建。返回 agentId 与角色简报 brief；之后用 experts_open_task 委派任务，并把 brief 注入执行该任务的 subagent prompt。",
			parameters: {
				name: { type: "string", description: "专家姓名或代号，如“架构师-陈”", required: true },
				role: { type: "string", description: "角色定位，如“后端架构师”“测试专家”“代码审查员”", required: true },
				expertise: { type: "array", items: { type: "string" }, description: "专长领域列表", required: true },
				responsibilities: { type: "array", items: { type: "string" }, description: "职责边界列表：该专家只负责这些工作", required: true }
			},
			output: {
				schema: { type: "json" },
				render(args, value) {
					if (!value.ok) return txt("❌ 创建专家失败：" + value.error);
					return txt("✅ 已创建专家 " + value.agent.name + "（" + value.agent.id + "）｜角色：" + value.agent.role
						+ "\n职责边界：" + value.agent.responsibilities.join("；")
						+ "\n\n下一步：用 experts_open_task 委派任务。角色简报（注入执行 subagent 的 prompt）：\n\n" + value.brief);
				}
			},
			execute: async (args) => {
				const name = String(args.name || "").trim();
				const role = String(args.role || "").trim();
				const expertise = Array.isArray(args.expertise) ? args.expertise.map((x) => String(x).trim()).filter(Boolean) : [];
				const responsibilities = Array.isArray(args.responsibilities) ? args.responsibilities.map((x) => String(x).trim()).filter(Boolean) : [];
				if (!name) return fail("name 不能为空");
				if (!role) return fail("role 不能为空");
				if (!expertise.length) return fail("expertise 至少一项");
				if (!responsibilities.length) return fail("responsibilities 至少一项");
				for (const a of agents.values()) if (a.name === name) return fail("已存在同名专家：" + name);
				agentSeq += 1;
				const a = { id: "a" + agentSeq, name, role, expertise, responsibilities, assigned: 0, delivered: 0, reviews: 0, tokens: { in: 0, out: 0 }, brief: agentBrief({ name, role, expertise, responsibilities }), createdAt: nowIso() };
				agents.set(a.id, a);
				logEvent("agent_created", a.id, null, role);
				notify();
				return { ok: true, agent: agentView(a), brief: a.brief, next: "用 experts_open_task 为其委派任务" };
			}
		},
		{
			name: "experts_open_task",
			description: "专家团：为某位专家委派一项任务，明确目标与验收标准（分工明确）。返回 taskId 与委派简报 brief；把 brief 作为 subagent prompt 下发执行，完成后用 experts_submit_result 登记成果。",
			parameters: {
				title: { type: "string", description: "任务标题", required: true },
				objective: { type: "string", description: "任务目标（做什么、为什么）", required: true },
				ownerId: { type: "string", description: "负责该任务的专家 agentId", required: true },
				acceptanceCriteria: { type: "array", items: { type: "string" }, description: "验收标准列表：交叉验证时逐条核对", required: true },
				dependsOn: { type: "array", items: { type: "string" }, description: "依赖的 taskId 列表（可选）" }
			},
			output: {
				schema: { type: "json" },
				render(args, value) {
					if (!value.ok) return txt("❌ 委派任务失败：" + value.error);
					return txt("✅ 已创建任务 " + value.task.id + "：" + value.task.title + "\n负责人：" + value.task.ownerName + "（" + value.task.ownerId + "）\n验收标准：\n"
						+ value.task.acceptanceCriteria.map((c, i) => i + 1 + ". " + c).join("\n")
						+ "\n\n委派简报（作为执行 subagent 的 prompt）：\n\n" + value.brief);
				}
			},
			execute: async (args) => {
				const title = String(args.title || "").trim();
				const objective = String(args.objective || "").trim();
				const ownerId = String(args.ownerId || "");
				const criteria = Array.isArray(args.acceptanceCriteria) ? args.acceptanceCriteria.map((x) => String(x).trim()).filter(Boolean) : [];
				const dependsOn = Array.isArray(args.dependsOn) ? args.dependsOn.map(String) : [];
				if (!title) return fail("title 不能为空");
				if (!objective) return fail("objective 不能为空");
				const owner = agents.get(ownerId);
				if (!owner) return fail("ownerId 无效：" + ownerId);
				if (!criteria.length) return fail("acceptanceCriteria 至少一条");
				for (const d of dependsOn) if (!tasks.has(d)) return fail("dependsOn 含未知任务：" + d);
				taskSeq += 1;
				const t = { id: "t" + taskSeq, title, objective, ownerId, criteria, dependsOn, status: "open", revision: 0, result: null, reviewers: [], reworkFindings: [], createdAt: nowIso() };
				tasks.set(t.id, t);
				owner.assigned += 1;
				logEvent("task_opened", owner.id, t.id, title);
				notify();
				return { ok: true, task: taskView(t), brief: dispatchBrief(owner, t), next: "将 brief 交给 subagent 执行；完成后用 experts_submit_result 提交成果" };
			}
		},
		{
			name: "experts_submit_result",
			description: "专家团：负责人提交任务成果（交付摘要 + 关键证据 + 验收自检）。仅 open/rework 状态允许；若已有评审名单则自动开启新一轮交叉评审，否则接着用 experts_request_review 指派评审。",
			parameters: {
				taskId: { type: "string", description: "任务 id", required: true },
				summary: { type: "string", description: "交付内容：成果摘要 + 关键证据 + 验收标准自检", required: true }
			},
			output: {
				schema: { type: "json" },
				render(args, value) {
					if (!value.ok) return txt("❌ 提交成果失败：" + value.error);
					return txt("📦 已登记成果：任务 " + value.task.id + " 第 " + value.task.revision + " 版，状态 " + value.task.status + "\n" + value.next);
				}
			},
			execute: async (args) => {
				const t = tasks.get(String(args.taskId || ""));
				if (!t) return fail("taskId 无效");
				if (t.status !== "open" && t.status !== "rework") return fail("当前状态 " + t.status + " 不允许提交成果（仅 open/rework）");
				const blocked = blockedByFor(t);
				if (blocked.length > 0) return fail("依赖任务未完成，无法提交成果：" + blocked.join("、"));
				const summary = String(args.summary || "").trim();
				if (!summary) return fail("summary 不能为空");
				t.revision += 1;
				t.result = { summary, at: nowIso() };
				t.reworkFindings = [];
				const owner = agents.get(t.ownerId);
				if (owner) owner.delivered += 1;
				let next;
				if (t.reviewers.length > 0) {
					for (const r of t.reviewers) { r.verdict = "pending"; r.findings = null; r.at = null; }
					t.status = "review";
					next = "已开启第 " + t.revision + " 轮交叉评审，请用 experts_submit_review 逐个登记评审结论";
				} else {
					next = "成果已记录；请用 experts_request_review 指派其他专家交叉验证";
				}
				logEvent("result_submitted", t.ownerId, t.id, "第 " + t.revision + " 版" + (t.reviewers.length ? "，进入评审" : ""));
				notify();
				return { ok: true, task: taskView(t), next };
			}
		},
		{
			name: "experts_request_review",
			description: "专家团：为已提交成果的任务指派交叉评审专家（不能是负责人本人）。返回每位评审的验证简报 reviewBriefs；把每份 brief 交给对应评审 subagent 独立复核，得到结论后用 experts_submit_review 登记。",
			parameters: {
				taskId: { type: "string", description: "任务 id", required: true },
				reviewerIds: { type: "array", items: { type: "string" }, description: "评审专家 agentId 列表（至少 1 名，不含负责人）", required: true }
			},
			output: {
				schema: { type: "json" },
				render(args, value) {
					if (!value.ok) return txt("❌ 指派评审失败：" + value.error);
					const parts = ["🔍 交叉评审已开启：任务 " + value.task.id + "，评审 " + value.task.reviews.length + " 名"];
					for (const b of value.reviewBriefs) parts.push("", "—— 评审简报 · " + b.reviewerName + "（" + b.reviewerId + "）——", b.brief);
					parts.push("", "下一步：将每份 brief 交给对应评审 subagent，收到结论后用 experts_submit_review 登记。");
					return txt(parts.join("\n"));
				}
			},
			execute: async (args) => {
				const t = tasks.get(String(args.taskId || ""));
				if (!t) return fail("taskId 无效");
				if (!t.result) return fail("该任务尚无交付成果，请先让负责人执行 experts_submit_result");
				if (t.status === "verified") return fail("任务已验证通过，无需再评审");
				const ids = Array.isArray(args.reviewerIds) ? args.reviewerIds.map(String) : [];
				if (!ids.length) return fail("reviewerIds 至少一名评审专家");
				const seen = new Set();
				for (const id of ids) {
					if (!agents.has(id)) return fail("评审专家不存在：" + id);
					if (id === t.ownerId) return fail("负责人不能评审自己的交付：" + id);
					if (seen.has(id)) return fail("评审专家重复：" + id);
					seen.add(id);
				}
				t.reviewers = ids.map((id) => ({ reviewerId: id, verdict: "pending", findings: null, at: null }));
				t.status = "review";
				const owner = agents.get(t.ownerId);
				const briefs = ids.map((id) => { const rv = agents.get(id); return { reviewerId: id, reviewerName: rv.name, brief: reviewBrief(rv, t, owner ? owner.name : t.ownerId) }; });
				logEvent("review_requested", t.ownerId, t.id, "评审：" + ids.map((id) => { const rv = agents.get(id); return rv ? rv.name : id; }).join("、"));
				notify();
				return { ok: true, task: taskView(t), reviewBriefs: briefs, next: "将每份 brief 交给对应评审 subagent，收到结论后用 experts_submit_review 登记" };
			}
		},
		{
			name: "experts_submit_review",
			description: "专家团：登记一名评审专家对任务的交叉验证结论。verdict：approve 通过 / reject 否决 / needs_changes 需修改（非通过必须给出 findings）。全体评审表态后自动裁决：全部通过 → verified；否则退回 rework 并汇总问题清单，负责人修改后重新提交。",
			parameters: {
				taskId: { type: "string", description: "任务 id", required: true },
				reviewerId: { type: "string", description: "评审专家 agentId", required: true },
				verdict: { type: "string", enum: ["approve", "reject", "needs_changes"], description: "验证结论", required: true },
				findings: { type: "string", description: "核对发现：非通过时必填（问题与证据）；通过时可选" }
			},
			output: {
				schema: { type: "json" },
				render(args, value) {
					if (!value.ok) return txt("❌ 登记评审失败：" + value.error);
					if (!value.settled) return txt("🕓 已登记评审结论（任务 " + value.task.id + "，状态 " + value.task.status + "）\n" + value.next);
					if (value.task.status === "verified") return txt("✅ " + value.message);
					let out = "🔁 " + value.message;
					if (value.findings && value.findings.length) out += "\n问题清单：\n" + value.findings.map((f) => "- " + f).join("\n");
					return txt(out);
				}
			},
			execute: async (args) => {
				const t = tasks.get(String(args.taskId || ""));
				if (!t) return fail("taskId 无效");
				if (t.status !== "review") return fail("任务不在评审中（当前状态：" + t.status + "）");
				const entry = t.reviewers.find((r) => r.reviewerId === String(args.reviewerId || ""));
				if (!entry) return fail("该专家不是本任务的评审");
				const verdict = String(args.verdict || "");
				if (verdict !== "approve" && verdict !== "reject" && verdict !== "needs_changes") return fail("verdict 必须是 approve / reject / needs_changes");
				const findings = String(args.findings || "").trim();
				if (verdict !== "approve" && !findings) return fail("非通过结论必须给出 findings（问题与证据）");
				entry.verdict = verdict;
				entry.findings = findings || null;
				entry.at = nowIso();
				const rv = agents.get(entry.reviewerId);
				if (rv) rv.reviews += 1;
				const pending = t.reviewers.filter((r) => r.verdict === "pending").length;
				logEvent("review_submitted", entry.reviewerId, t.id, verdict);
				if (pending > 0) { notify(); return { ok: true, settled: false, task: taskView(t), next: "还有 " + pending + " 名评审未表态" }; }
				const rejected = t.reviewers.filter((r) => r.verdict !== "approve");
				if (rejected.length === 0) {
					t.status = "verified";
					logEvent("task_verified", t.ownerId, t.id, "全体评审通过");
					notify();
					return { ok: true, settled: true, task: taskView(t), message: "全体评审通过，任务 " + t.id + "（" + t.title + "）验证完成" };
				}
				t.status = "rework";
				t.reworkFindings = rejected.map((r) => { const ra = agents.get(r.reviewerId); return (ra ? ra.name : r.reviewerId) + "（" + r.verdict + "）：" + r.findings; });
				logEvent("task_rework", t.ownerId, t.id, "待解决问题 " + t.reworkFindings.length + " 条");
				notify();
				return { ok: true, settled: true, task: taskView(t), message: "未达成共识，任务 " + t.id + " 退回返工；请负责人按问题清单修正后重新 experts_submit_result", findings: t.reworkFindings.slice() };
			}
		},
		{
			name: "experts_status",
			description: "专家团：读取当前团队与任务总览（专家分工、任务看板、交叉验证进度与裁决结果），用于规划下一步调度。结果卡片会渲染专家团仪表盘。",
			parameters: {},
			output: {
				schema: { type: "json" },
				render(args, value) { return renderStatus(value); },
				presentationMeta(args, value) { return value; }
			},
			execute: async () => snapshot(),
			presentCall: () => ({ card: "generic", title: "专家团总览", kind: "other" })
		},
		{
			name: "experts_remove_agent",
			description: "专家团：移除一名专家。若其仍负责未完成任务或有未表态的评审，会被拒绝。",
			parameters: {
				agentId: { type: "string", description: "专家 agentId", required: true }
			},
			output: {
				schema: { type: "json" },
				render(args, value) {
					if (!value.ok) return txt("❌ 移除失败：" + value.error);
					return txt("已移除专家 " + value.removed);
				}
			},
			execute: async (args) => {
				const id = String(args.agentId || "");
				const a = agents.get(id);
				if (!a) return fail("agentId 无效");
				for (const t of tasks.values()) {
					if (t.ownerId === id && !TERMINAL[t.status]) return fail("该专家仍负责未完成任务 " + t.id + "，请先完成或改派");
					if (t.reviewers.some((r) => r.reviewerId === id && r.verdict === "pending")) return fail("该专家在任务 " + t.id + " 有未完成评审");
				}
				agents.delete(id);
				logEvent("agent_removed", id, null, "已移除");
				notify();
				return { ok: true, removed: id };
			}
		}
	];

	return {
		agents, tasks, toolDefs, snapshot,
		subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
		observeSubagentStart, observeSubagentToolCall, observeSubagentEnd
	};
}

/**
 * Optional live-data HTTP channel for the browser panel.
 *
 * /api/expert-team/state   → JSON snapshot (versioned), cache: no-store.
 * /api/expert-team/events  → SSE: `: connected`, then one `snapshot` event
 *                            carrying the full JSON snapshot on connect and
 *                            after every mutation. GET/HEAD only; everything
 *                            else answers 405 (the dsh-client-hmr convention).
 * The routes live in the mounting fiber: unload disposes them and destroys
 * every open connection.
 */
function registerHttp(ctx, team) {
	const webServer = ctx.get("webServer");
	if (!webServer) return;
	ctx.effect(() => {
		const connections = new Set();
		const frame = () => "event: snapshot\ndata: " + JSON.stringify(team.snapshot()) + "\n\n";
		const broadcast = () => {
			const line = frame();
			for (const res of connections) {
				try { res.write(line); } catch { /* connection may be gone */ }
			}
		};
		const offChange = team.subscribe(broadcast);
		const disposeState = webServer.register({
			kind: "exact",
			path: "/api/expert-team/state",
			handler(req, res) {
				if (req.method !== "GET" && req.method !== "HEAD") {
					res.writeHead(405); res.end(); return;
				}
				const body = JSON.stringify(team.snapshot());
				res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
				res.end(req.method === "HEAD" ? undefined : body);
			}
		});
		const disposeEvents = webServer.register({
			kind: "exact",
			path: "/api/expert-team/events",
			handler(req, res) {
				if (req.method !== "GET" && req.method !== "HEAD") {
					res.writeHead(405); res.end(); return;
				}
				res.writeHead(200, {
					"content-type": "text/event-stream",
					"cache-control": "no-cache",
					"connection": "keep-alive"
				});
				res.write(": connected\n\n");
				res.write(frame());
				connections.add(res);
				res.on("close", () => connections.delete(res));
			}
		});
		return () => {
			offChange();
			disposeState();
			disposeEvents();
			for (const res of connections) res.destroy();
			connections.clear();
		};
	}, "expert-team: http data routes");
}

/**
 * 挂接 subagent 观察链（token 归集 + 时间线事件）。
 * - subagent/start：记录子会话 id（FIFO）
 * - tools/result：subagent 工具调用 → 从委派/评审简报解析任务与专家 → 与最近子会话配对
 * - subagent/end：测量该子会话真实 token（sessionProjections.tokenUsage，provider 上报）
 *   → 累计到归属专家 + 记录 subagent_done 时间线事件
 * sessions / sessionProjections 为可选服务（ctx.get），缺失时仍记录事件但 token 为 0。
 */
function attachSubagentObservers(ctx, team) {
	const sessions = ctx.get("sessions");
	const projections = ctx.get("sessionProjections");
	ctx.on("subagent/start", (info) => {
		if (info && info.id) team.observeSubagentStart(info.id);
	});
	ctx.on("tools/result", (exec) => {
		try {
			const input = exec && exec.input;
			const name = input && input.name;
			if (name !== "subagent" && name !== "subagent_fork") return;
			const args = input.arguments || {};
			const prompt = Array.isArray(args.prompt)
				? args.prompt.map((b) => (b && b.text) || "").join("\n")
				: String(args.prompt || "");
			if (prompt) team.observeSubagentToolCall(prompt);
		} catch { /* 解析失败不阻断工具执行 */ }
	});
	ctx.on("subagent/end", (info) => {
		let tokenIn = 0;
		let tokenOut = 0;
		try {
			if (sessions && projections && info && info.id) {
				const session = sessions.get(info.id);
				if (session) {
					const tu = projections.snapshot(session).tokenUsage;
					if (tu) {
						tokenIn = tu.uncachedInputTokens || 0;
						tokenOut = tu.outputTokens || 0;
					}
				}
			}
		} catch { /* 测量失败：仍记录事件，token 为 0 */ }
		team.observeSubagentEnd(info && info.id, tokenIn, tokenOut);
	});
}

/** Register the experts_* tools on the mounting session's tool registry. */
function apply(ctx) {
	const team = makeTeam();
	for (const def of team.toolDefs) ctx.tools.register(defineTool(def));
	registerHttp(ctx, team);
	attachSubagentObservers(ctx, team);
}

export { apply, inject, resolveStorePath };
