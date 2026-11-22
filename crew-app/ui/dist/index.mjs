import { Badge as e, Btn as t, Card as n, CardTitle as r, EmptyState as i, PageHeader as a, StatCard as o } from "@kirocrew/app-sdk/ui";
import { useCallback as s, useEffect as c, useMemo as l, useRef as u, useState as d } from "react";
import { useAppApi as f, useAppEvents as p, useAppInfo as m, useChatLauncher as h, useNavBadge as g, useNotify as _ } from "@kirocrew/app-sdk";
import { Fragment as v, jsx as y, jsxs as b } from "react/jsx-runtime";
// src/alerts.ts
var x = "paperbridge:scan-alert", S = (e) => typeof e == "object" && !!e && !Array.isArray(e), C = (e) => Array.isArray(e) && e.every((e) => typeof e == "string");
function w(e) {
	if (typeof e == "string") try {
		return w(JSON.parse(e));
	} catch {
		return null;
	}
	if (!S(e) || e.type !== "paperbridge:scan-alert" || e.app !== "elder-care" || typeof e.cardId != "string" || typeof e.scannedAt != "string" || Number.isNaN(Date.parse(e.scannedAt)) || e.severity !== "high" && e.severity !== "medium" && e.severity !== "none" || !(e.adherencePct === null || typeof e.adherencePct == "number" && e.adherencePct >= 0 && e.adherencePct <= 100) || !C(e.symptomDays) || !C(e.needsReview) || !Array.isArray(e.missed) || !Array.isArray(e.alerts)) return null;
	let t = e.missed.filter((e) => S(e) && typeof e.day == "string" && (e.slot === "Morning" || e.slot === "Night")), n = e.alerts.filter((e) => S(e) && (e.level === "high" || e.level === "medium" || e.level === "info") && typeof e.title == "string" && typeof e.detail == "string");
	return {
		type: x,
		app: "elder-care",
		cardId: e.cardId.slice(0, 120),
		scannedAt: e.scannedAt,
		severity: e.severity,
		adherencePct: e.adherencePct,
		missed: t.map((e) => ({
			day: e.day.slice(0, 20),
			slot: e.slot
		})),
		symptomDays: e.symptomDays.map((e) => e.slice(0, 20)),
		needsReview: e.needsReview.map((e) => e.slice(0, 120)),
		alerts: n.map((e) => ({
			level: e.level,
			title: e.title.slice(0, 200),
			detail: e.detail.slice(0, 500)
		})),
		...Number.isInteger(e.manualOverrides) && e.manualOverrides > 0 && e.manualOverrides <= 1e3 ? { manualOverrides: e.manualOverrides } : {}
	};
}
function T(e) {
	if (!e.includes("paperbridge:scan-alert")) return null;
	for (let t = e.indexOf("{"); t !== -1; t = e.indexOf("{", t + 1)) {
		let n = 0;
		for (let r = t; r < e.length; r++) if (e[r] === "{") n++;
		else if (e[r] === "}" && --n === 0) {
			let n = w(e.slice(t, r + 1));
			if (n) return n;
			break;
		}
	}
	return null;
}
function E(e) {
	let t = w(e);
	if (t) return t;
	if (!S(e)) return null;
	for (let t of [
		"alert",
		"data",
		"payload",
		"detail"
	]) {
		let n = w(e[t]);
		if (n) return n;
	}
	for (let t of [
		"body",
		"text",
		"message",
		"title"
	]) {
		let n = e[t];
		if (typeof n == "string") {
			let e = T(n);
			if (e) return e;
		}
	}
	return null;
}
function D(e) {
	return `${e.cardId}@${e.scannedAt}`;
}
function O(e, t, n, r) {
	let i = D(t), a = e.find((e) => e.id === i);
	return [{
		...t,
		id: i,
		source: a?.source ?? n,
		receivedAt: a?.receivedAt ?? r.toISOString(),
		reviewed: a?.reviewed ?? !1
	}, ...e.filter((e) => e.id !== i)].sort((e, t) => Date.parse(t.scannedAt) - Date.parse(e.scannedAt)).slice(0, 50);
}
function k(e) {
	return e.filter((e) => !e.reviewed && e.severity !== "none").length;
}
function A(e) {
	return `kirocrew.app.${e}.alerts.v1`;
}
function j(e, t) {
	try {
		let n = e?.getItem(t);
		if (!n) return [];
		let r = JSON.parse(n);
		return Array.isArray(r) ? r.flatMap((e) => {
			let t = w(e);
			if (!t || !S(e)) return [];
			let n = [
				"browser-event",
				"notification",
				"demo",
				"pasted"
			].find((t) => t === e.source) ?? "pasted", r = typeof e.receivedAt == "string" ? e.receivedAt : t.scannedAt;
			return [{
				...t,
				id: D(t),
				source: n,
				receivedAt: r,
				reviewed: e.reviewed === !0
			}];
		}) : [];
	} catch {
		return [];
	}
}
function M(e, t, n) {
	try {
		e?.setItem(t, JSON.stringify(n.slice(0, 50)));
	} catch {}
}
function N(e) {
	return {
		type: x,
		app: "elder-care",
		cardId: "elder-care-weekly",
		scannedAt: e.toISOString(),
		severity: "high",
		adherencePct: 71,
		missed: [
			{
				day: "Tue",
				slot: "Night"
			},
			{
				day: "Thu",
				slot: "Morning"
			},
			{
				day: "Thu",
				slot: "Night"
			},
			{
				day: "Sat",
				slot: "Night"
			}
		],
		symptomDays: ["Thu", "Fri"],
		needsReview: ["Wednesday water"],
		alerts: [
			{
				level: "high",
				title: "Medication taken 71% of the time",
				detail: "4 of 14 doses were missed. The goal is 80% or more."
			},
			{
				level: "high",
				title: "No medication at all on Thursday",
				detail: "Both morning and night doses were missed."
			},
			{
				level: "high",
				title: "Dizzy or in pain on 2 days",
				detail: "Thursday, Friday. Consider calling the doctor."
			},
			{
				level: "medium",
				title: "Low energy on 2 days",
				detail: "Thursday, Friday (energy 2 or below)."
			},
			{
				level: "medium",
				title: "Enough water on only 3 of 7 days",
				detail: "The goal is 6+ cups on at least 5 days."
			},
			{
				level: "info",
				title: "1 mark needs a human check",
				detail: "Wednesday water. These are not counted as taken or missed."
			}
		]
	};
}
function P(e) {
	let { type: t, app: n, cardId: r, scannedAt: i, severity: a, adherencePct: o, missed: s, symptomDays: c, needsReview: l, alerts: u, manualOverrides: d } = e;
	return [
		"Load the adherence-analysis skill and draft a caregiver check-in for this PaperBridge Weekly Care Card.",
		"Start with what went well, list what to ask about, and say whether to contact the clinician.",
		"",
		"```json",
		JSON.stringify({
			type: t,
			app: n,
			cardId: r,
			scannedAt: i,
			severity: a,
			adherencePct: o,
			missed: s,
			symptomDays: c,
			needsReview: l,
			alerts: u,
			...d ? { manualOverrides: d } : {}
		}, null, 2),
		"```"
	].join("\n");
}
// src/sdk.ts
var F = "care-auditor";
function I() {
	let e = m(), t = f(), n = _(), r = g(), i = A(e.name), [a, o] = d(() => j(globalThis.localStorage, i)), [h, v] = d({ online: null }), y = u(n);
	y.current = n;
	let b = s((e, t, n = !0) => {
		o((r) => (!r.some((t) => t.cardId === e.cardId && t.scannedAt === e.scannedAt) && n && e.severity === "high" && y.current(`PaperBridge: ${e.alerts[0]?.title ?? "new care card alert"}`, { type: "error" }), O(r, e, t, /* @__PURE__ */ new Date())));
	}, []);
	c(() => {
		M(globalThis.localStorage, i, a), r(k(a));
	}, [
		a,
		i,
		r
	]), p("notification", (e) => {
		let t = E(e);
		t && b(t, "notification");
	}), p("task_complete", (e) => {
		JSON.stringify(e ?? "").includes("care-auditor") && y.current("care-auditor finished a check-in draft", { type: "success" });
	}), c(() => {
		let e = (e) => {
			let t = E(e.detail);
			t && b(t, "browser-event");
		};
		return window.addEventListener(x, e), () => window.removeEventListener(x, e);
	}, [b]), c(() => {
		let e = !1;
		return t.get("/api/notifications").then((t) => {
			if (!e) for (let e of t?.notifications ?? []) {
				let t = E(e);
				t && b(t, "notification", !1);
			}
		}).catch(() => void 0), t.get("/api/status").then((t) => !e && v({
			online: !0,
			version: t?.version
		})).catch(() => !e && v({ online: !1 })), () => {
			e = !0;
		};
	}, [t, b]);
	let S = s((e, t = !0) => {
		o((n) => n.map((n) => n.id === e ? {
			...n,
			reviewed: t
		} : n));
	}, []), C = s(() => o([]), []);
	return l(() => ({
		alerts: a,
		add: b,
		markReviewed: S,
		clear: C,
		status: h,
		notify: n
	}), [
		a,
		b,
		S,
		C,
		h,
		n
	]);
}
function L() {
	let { openChat: e } = h();
	return s((t) => e({
		agent: F,
		message: P(t),
		autoSend: !1
	}), [e]);
}
// src/App.tsx
var R = {
	Mon: "Monday",
	Tue: "Tuesday",
	Wed: "Wednesday",
	Thu: "Thursday",
	Fri: "Friday",
	Sat: "Saturday",
	Sun: "Sunday"
}, z = (e) => R[e] ?? e, B = {
	high: {
		variant: "err",
		label: "Needs attention"
	},
	medium: {
		variant: "warn",
		label: "Keep an eye on"
	},
	none: {
		variant: "ok",
		label: "All good"
	}
}, V = {
	high: "err",
	medium: "warn",
	info: "muted"
}, H = {
	"browser-event": "PaperBridge scan",
	notification: "Crew notification",
	demo: "Demo alert",
	pasted: "Pasted JSON"
};
function U(e) {
	return new Date(e).toLocaleString(void 0, {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit"
	});
}
function W({ alert: i, onReview: a, onDraft: o }) {
	let s = B[i.severity];
	return /* @__PURE__ */ b(n, { children: [
		/* @__PURE__ */ b("div", {
			className: "flex flex-wrap items-center justify-between gap-2",
			children: [/* @__PURE__ */ b(r, { children: ["Weekly Care Card, scanned ", U(i.scannedAt)] }), /* @__PURE__ */ b("div", {
				className: "flex items-center gap-2",
				children: [
					/* @__PURE__ */ y(e, {
						variant: s.variant,
						children: s.label
					}),
					i.manualOverrides ? /* @__PURE__ */ b(e, {
						variant: "aim",
						title: "Unclear marks a person checked on the paper card",
						children: [
							"Manually verified (",
							i.manualOverrides,
							")"
						]
					}) : null,
					i.reviewed && /* @__PURE__ */ y(e, {
						variant: "muted",
						children: "Reviewed"
					})
				]
			})]
		}),
		/* @__PURE__ */ b("p", {
			className: "text-sm",
			children: [
				/* @__PURE__ */ y("strong", { children: i.adherencePct === null ? "Adherence unknown" : `${i.adherencePct}% of doses taken` }),
				i.missed.length > 0 && /* @__PURE__ */ b(v, { children: [" · Missed: ", i.missed.map((e) => `${z(e.day)} ${e.slot.toLowerCase()}`).join(", ")] }),
				i.symptomDays.length > 0 && /* @__PURE__ */ b(v, { children: [" · Dizzy or pain: ", i.symptomDays.map(z).join(", ")] })
			]
		}),
		i.alerts.length > 0 && /* @__PURE__ */ y("ul", {
			className: "mt-3 flex flex-col gap-2",
			"aria-label": "Alerts",
			children: i.alerts.map((t) => /* @__PURE__ */ b("li", {
				className: "flex items-start gap-2 text-sm",
				children: [/* @__PURE__ */ y(e, {
					variant: V[t.level],
					children: t.level
				}), /* @__PURE__ */ b("span", { children: [
					/* @__PURE__ */ b("strong", { children: [t.title, "."] }),
					" ",
					/* @__PURE__ */ y("span", {
						className: "text-muted",
						children: t.detail
					})
				] })]
			}, t.title))
		}),
		i.needsReview.length > 0 && /* @__PURE__ */ b("p", {
			className: "mt-3 text-sm",
			children: [
				/* @__PURE__ */ y("strong", { children: "Check on the paper card:" }),
				" ",
				i.needsReview.join(", "),
				". Unclear marks are never guessed."
			]
		}),
		/* @__PURE__ */ b("div", {
			className: "mt-4 flex flex-wrap items-center gap-2",
			children: [
				/* @__PURE__ */ y(t, {
					primary: !0,
					onClick: o,
					children: "Draft Caregiver Check-In"
				}),
				/* @__PURE__ */ y(t, {
					onClick: () => a(!i.reviewed),
					children: i.reviewed ? "Mark as open" : "Mark reviewed"
				}),
				/* @__PURE__ */ b("span", {
					className: "text-muted text-[13px]",
					children: ["Source: ", H[i.source]]
				})
			]
		})
	] });
}
function G({ onAdd: e }) {
	let [i, a] = d(""), [o, s] = d("");
	return /* @__PURE__ */ b(n, { children: [
		/* @__PURE__ */ y(r, { children: "Paste a PaperBridge alert" }),
		/* @__PURE__ */ b("p", {
			className: "text-muted text-sm",
			children: [
				"In PaperBridge, scan a card and open \"Show raw JSON output\", or paste a ",
				/* @__PURE__ */ y("code", { children: "paperbridge:scan-alert" }),
				" payload."
			]
		}),
		/* @__PURE__ */ y("label", {
			className: "mt-2 block text-sm",
			htmlFor: "pb-alert-json",
			children: "Alert JSON"
		}),
		/* @__PURE__ */ y("textarea", {
			id: "pb-alert-json",
			value: i,
			onChange: (e) => {
				a(e.target.value), s("");
			},
			rows: 5,
			className: "mt-1 w-full rounded-md border border-border bg-card p-2 font-mono text-[13px]",
			spellCheck: !1
		}),
		o && /* @__PURE__ */ y("p", {
			role: "alert",
			className: "mt-1 text-sm text-danger-text",
			children: o
		}),
		/* @__PURE__ */ y("div", {
			className: "mt-2",
			children: /* @__PURE__ */ y(t, {
				onClick: () => {
					e(i) ? a("") : s("That is not a PaperBridge scan alert (type \"paperbridge:scan-alert\").");
				},
				children: "Add alert"
			})
		})
	] });
}
function K() {
	let { alerts: e, add: r, markReviewed: s, clear: c, status: l } = I(), u = L(), [f, p] = d(!1), m = e[0], h = k(e);
	return /* @__PURE__ */ b(v, { children: [/* @__PURE__ */ y(a, {
		title: "PaperBridge Care",
		subtitle: "Alerts from paper Weekly Care Cards, decoded without AI. Draft the caregiver check-in in one click.",
		actions: /* @__PURE__ */ b("div", {
			className: "flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ y(t, {
					primary: !0,
					onClick: () => r(N(/* @__PURE__ */ new Date()), "demo"),
					children: "Load demo alert"
				}),
				/* @__PURE__ */ y(t, {
					onClick: () => p((e) => !e),
					"aria-expanded": f,
					children: f ? "Hide paste box" : "Paste alert JSON"
				}),
				e.length > 0 && /* @__PURE__ */ y(t, {
					danger: !0,
					onClick: c,
					children: "Clear all"
				})
			]
		})
	}), /* @__PURE__ */ b("div", {
		className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0",
		children: [
			/* @__PURE__ */ b("div", {
				className: "grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-6",
				children: [
					/* @__PURE__ */ y(o, {
						label: "Latest adherence",
						value: m ? m.adherencePct === null ? "-" : `${m.adherencePct}%` : "-",
						accent: !0
					}),
					/* @__PURE__ */ y(o, {
						label: "Open alerts",
						value: h
					}),
					/* @__PURE__ */ y(o, {
						label: "Missed doses (latest)",
						value: m ? m.missed.length : "-"
					}),
					/* @__PURE__ */ y(o, {
						label: "Symptom days (latest)",
						value: m ? m.symptomDays.length : "-"
					}),
					/* @__PURE__ */ y(o, {
						label: "Crew gateway",
						value: l.online === null ? "..." : l.online ? `Online${l.version ? ` ${l.version}` : ""}` : "Offline"
					})
				]
			}),
			/* @__PURE__ */ b("div", {
				className: "flex flex-col gap-4",
				"aria-live": "polite",
				children: [f && /* @__PURE__ */ y(G, { onAdd: (e) => {
					let t = w(e.trim());
					return t && r(t, "pasted"), t !== null;
				} }), e.length === 0 ? /* @__PURE__ */ y(n, { children: /* @__PURE__ */ y(i, {
					icon: /* @__PURE__ */ y("span", {
						"aria-hidden": !0,
						children: "♡"
					}),
					title: "No care card alerts yet",
					subtitle: "Scan a PaperBridge Weekly Care Card, or load the demo alert to see how it works.",
					action: /* @__PURE__ */ y(t, {
						primary: !0,
						onClick: () => r(N(/* @__PURE__ */ new Date()), "demo"),
						children: "Load demo alert"
					})
				}) }) : e.map((e) => /* @__PURE__ */ y(W, {
					alert: e,
					onReview: (t) => s(e.id, t),
					onDraft: () => u(e)
				}, e.id))]
			}),
			/* @__PURE__ */ y("p", {
				className: "mt-6 text-muted text-[13px]",
				children: "Alerts hold aggregate data only (adherence, missed slots, symptom days). No card images or personal details are stored."
			})
		]
	})] });
}
export { K as default };
