/* AFTERPACT console: dependency-free SPA. Every view reads real API data;
   simulated sources are badged via origin markers. */
"use strict";

/* ---------- tiny helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const view = () => $("#view");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "COP", "CRC", "HUF", "ISK", "PYG", "TWD", "UGX"]);
const THREE_DECIMAL = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

function formatMoney(money, opts = {}) {
  if (!money || typeof money.amountMinor !== "number") return "—";
  const decimals = ZERO_DECIMAL.has(money.currency) ? 0 : THREE_DECIMAL.has(money.currency) ? 3 : 2;
  const major = money.amountMinor / 10 ** decimals;
  try {
    return new Intl.NumberFormat(opts.locale, { style: "currency", currency: money.currency }).format(major);
  } catch {
    return `${major.toFixed(decimals)} ${escapeHtml(money.currency)}`;
  }
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return escapeHtml(String(iso));
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function shortId(id) {
  const s = String(id ?? "");
  return s.length > 13 ? `${s.slice(0, 8)}…` : s;
}

function toast(message, kind = "info") {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = `toast ${kind === "ok" ? "ok" : kind === "error" ? "error" : ""}`;
  el.textContent = message;
  box.appendChild(el);
  window.setTimeout(() => el.remove(), kind === "error" ? 8000 : 5000);
}

function confirmDialog(title, text, okLabel = "Confirm") {
  const dialog = $("#confirmDialog");
  $("#confirmTitle").textContent = title;
  $("#confirmText").textContent = text;
  $("#confirmOk").textContent = okLabel;
  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      resolve(dialog.returnValue === "ok");
    };
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

/* ---------- origin markers (real vs simulated) ---------- */
const ORIGINS = {
  "real-api": { label: "REAL API", cls: "ok" },
  "paypal-sandbox-live": { label: "PAYPAL SANDBOX · LIVE", cls: "accent" },
  "mock-simulated": { label: "SIMULATED · MOCK", cls: "warn" },
  "mock-simulated-buyer": { label: "SIMULATED · MOCK BUYER", cls: "warn" },
  "simulated-catalog": { label: "SIMULATED · CATALOG", cls: "warn" },
  "simulated-logistics": { label: "SIMULATED · LOGISTICS", cls: "violet" },
  "heuristic-parse": { label: "HEURISTIC PARSE", cls: "info" },
  "not-in-build": { label: "NOT IN THIS BUILD", cls: "bad" },
  "channel3-live": { label: "CHANNEL3 · LIVE", cls: "accent" },
  "channel3-unavailable": { label: "DISCOVERY UNAVAILABLE", cls: "warn" },
  "ai-live": { label: "AI · LIVE", cls: "accent" },
  "ai-off": { label: "AI · OFF (HEURISTIC)", cls: "info" },
  "recorded-ai": { label: "RECORDED VERIFIED AI RUN", cls: "violet" },
  "recorded-sandbox": { label: "RECORDED SANDBOX EVIDENCE", cls: "accent" },
  "ag-grid-community": { label: "AG GRID COMMUNITY", cls: "ok" },
  "native-table": { label: "NATIVE TABLE FALLBACK", cls: "info" },
  "computed-schedule": { label: "COMPUTED SCHEDULE", cls: "violet" },
  "fallback-timeline": { label: "FALLBACK TIMELINE", cls: "violet" },
};

function originPill(origin) {
  const o = ORIGINS[origin] ?? { label: String(origin).toUpperCase(), cls: "" };
  return `<span class="pill ${o.cls}">${escapeHtml(o.label)}</span>`;
}

function statePill(state) {
  const good = new Set(["APPROVED", "PAYMENT_CAPTURED", "RESOLUTION_VERIFIED", "OUTCOME_MONITORING"]);
  const bad = new Set(["DECLINED", "EXPIRED", "CANCELED", "FAILED"]);
  const cls = good.has(state) ? "ok" : bad.has(state) ? "bad" : state === "ESCALATED" || state === "INCIDENT_DETECTED" ? "warn" : "info";
  return `<span class="pill ${cls}">${escapeHtml(state)}</span>`;
}

/* ---------- api client ---------- */
async function api(path, { method = "GET", body = undefined } = {}) {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Request failed (${res.status}) with a non-JSON response`);
  }
  if (!res.ok) {
    const err = json && json.error ? json.error : {};
    const details = err.details ? ` — ${JSON.stringify(err.details).slice(0, 300)}` : "";
    throw new Error(`${err.code ?? "error"}: ${err.message ?? res.statusText}${details}`);
  }
  return json.data;
}

/* ---------- theme ---------- */
function initTheme() {
  const root = document.documentElement;
  const stored = localStorage.getItem("afterpact-theme");
  if (stored === "light" || stored === "dark") {
    root.dataset.theme = stored;
  } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    root.dataset.theme = "light";
  }
  $("#themeToggle").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("afterpact-theme", root.dataset.theme);
    syncAgStudioThemeMode();
  });
  syncAgStudioThemeMode();
}

/* ---------- AG Studio theme mode sync ---------- */
// AG Studio 3.1.0 switches built-in and custom themes via the
// data-ag-theme-mode attribute (AG docs: "Updating theme & mode").
function syncAgStudioThemeMode() {
  const mode = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  document.documentElement.dataset.agThemeMode = mode;
  document.documentElement.setAttribute("data-ag-theme-mode", mode);
}

/* ---------- topbar status ---------- */
async function refreshTopbar() {
  try {
    const [health, aiStatus] = await Promise.all([
      api("/api/health"),
      api("/api/ai/status").catch(() => null),
    ]);
    const transport = $("#transportPill");
    const live = health.transport === "paypal-sandbox-live";
    transport.className = `pill ${live ? "accent" : "warn"}`;
    transport.textContent = live ? "PAYPAL SANDBOX · LIVE" : "MOCK · SIMULATED";
    const chain = $("#chainPill");
    chain.className = `pill ${health.auditChainValid ? "ok" : "bad"}`;
    chain.textContent = health.auditChainValid ? `CHAIN VALID · ${health.auditEntries}` : "CHAIN BROKEN";
    if (health.killSwitch) {
      chain.textContent += " · KILL-SWITCH ON";
      chain.className = "pill bad";
    }
    const aiPill = $("#aiPill");
    if (aiPill) {
      if (aiStatus && aiStatus.keyed) {
        aiPill.className = "pill accent";
        aiPill.textContent = `AI · LIVE ${aiStatus.model ?? ""}`.trim();
        aiPill.title = `provider ${aiStatus.provider ?? "?"} · model ${aiStatus.model ?? "?"}`;
      } else {
        aiPill.className = "pill info";
        aiPill.textContent = "AI · OFF";
      }
    }
  } catch {
    $("#transportPill").textContent = "API UNREACHABLE";
    $("#transportPill").className = "pill bad";
    $("#chainPill").textContent = "—";
    const aiPill = $("#aiPill");
    if (aiPill) aiPill.textContent = "—";
  }
}

/* ---------- shared fragments ---------- */
function viewHead(title, subtitle) {
  return `<div class="view-head"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>`;
}

function errorBanner(message) {
  return `<div class="error-banner" role="alert"><strong>Something went wrong.</strong> ${escapeHtml(message)}</div>`;
}

/** AI-action failure: an unkeyed box must point at recorded evidence, not dead-end. */
function aiErrorHtml(err) {
  const message = err && err.message ? err.message : String(err);
  if (message.startsWith("ai-unavailable")) {
    return `<div class="error-banner" role="alert"><strong>Live AI is off on this box</strong> (no inference key — by design, to avoid an unbounded paid endpoint). `
      + `See <a href="#/ai-gallery">RECORDED VERIFIED AI RUNs in the AI Evidence gallery →</a></div>`;
  }
  return errorBanner(message);
}

/** Incident details carry a "[category/severity] " prefix; drop it next to the pills. */
function shortDetail(detail) {
  return String(detail).replace(/^\[[^\]]+\]\s*/, "");
}

function emptyState(glyph, title, hint, actionHtml = "") {
  return `<div class="empty"><span class="glyph" aria-hidden="true">${glyph}</span><strong>${escapeHtml(title)}</strong><p class="muted small">${escapeHtml(hint)}</p>${actionHtml}</div>`;
}

function loadingState(label = "Loading…") {
  return `<div class="loading" role="status" aria-live="polite"><div class="skeleton" style="height:1.2rem;width:40%"></div><p>${escapeHtml(label)}</p></div>`;
}

function setNav(route) {
  document.querySelectorAll("#sidenav a").forEach((a) => {
    if (a.dataset.route === route) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

/* ================================================================
   VIEW: Command Center
   ================================================================ */
async function renderCommand() {
  setNav("command");
  view().innerHTML = viewHead("Command Center", "Live commercial activity, financial exposure, and the resolution queue — all from the real API.") + loadingState();
  try {
    const m = await api("/api/metrics");
    const states = Object.entries(m.promisesByState ?? {}).sort((a, b) => b[1] - a[1]);
    const money = { currency: m.currency ?? "USD" };
    view().innerHTML = viewHead("Command Center", "Live commercial activity, financial exposure, and the resolution queue — all from the real API.") + `
      <div class="badge-row" style="margin-bottom:1rem">
        ${originPill(m.transport)}
        ${m.chainValid ? '<span class="pill ok">FLIGHT RECORDER · VALID</span>' : '<span class="pill bad">FLIGHT RECORDER · BROKEN</span>'}
        ${m.killSwitch ? '<span class="pill bad">KILL-SWITCH ENGAGED</span>' : ""}
      </div>
      ${states.length === 0 ? `<div class="card section-gap">
        <h2>AI agents can already buy. AFTERPACT makes sure the outcome matches the promise.</h2>
        <p class="muted small">Watch a purchase go wrong — short delivery, detected automatically — then see evidence-backed AI analysis, a human approval, and a verified PayPal refund.</p>
        <div class="button-row"><a class="button" href="#/demo">Run the 2-minute flagship demo</a><a class="button secondary" href="#/copilot">Open Purchase Copilot</a></div>
      </div>` : ""}
      <div class="grid kpi">
        <div class="card"><div class="kpi-label">Amount at risk</div><div class="kpi-value">${formatMoney({ ...money, amountMinor: m.atRiskMinor })}</div><div class="kpi-sub">Captured, not yet verified</div></div>
        <div class="card"><div class="kpi-label">Captured</div><div class="kpi-value">${formatMoney({ ...money, amountMinor: m.capturedMinor })}</div><div class="kpi-sub">Settled provider captures</div></div>
        <div class="card"><div class="kpi-label">Refunded</div><div class="kpi-value">${formatMoney({ ...money, amountMinor: m.refundedMinor })}</div><div class="kpi-sub">Verified refunds</div></div>
        <div class="card"><div class="kpi-label">Open incidents</div><div class="kpi-value">${m.openIncidentCount}</div><div class="kpi-sub">${m.resolutionQueue?.length ?? 0} awaiting resolution approval</div></div>
      </div>
      <div class="grid two section-gap">
        <div class="card">
          <h2>Promises by state</h2>
          ${states.length === 0 ? emptyState("◈", "No promises yet", "Run the flagship demo or create one in the Purchase Copilot.", '<p><a class="button small secondary" href="#/copilot">Open Purchase Copilot</a></p>') : `
          <div class="table-wrap"><table>
            <thead><tr><th>State</th><th class="num">Count</th></tr></thead>
            <tbody>${states.map(([s, n]) => `<tr><td>${statePill(s)}</td><td class="num">${n}</td></tr>`).join("")}</tbody>
          </table></div>`}
        </div>
        <div class="card">
          <h2>Resolution queue</h2>
          ${(m.resolutionQueue ?? []).length === 0 ? `<p class="muted small">Nothing awaiting approval. New proposals appear here.</p>` : `
          <div class="table-wrap"><table>
            <thead><tr><th>Proposal</th><th>Kind</th><th class="num">Amount</th></tr></thead>
            <tbody>${m.resolutionQueue.map((p) => `<tr><td><a href="#/recovery">${escapeHtml(shortId(p.id))}</a></td><td>${escapeHtml(p.kind)}</td><td class="num">${p.amount ? formatMoney(p.amount) : "—"}</td></tr>`).join("")}</tbody>
          </table></div>`}
        </div>
      </div>
      <div class="card section-gap">
        <h2>Recent Flight Recorder events</h2>
        ${(m.recentEvents ?? []).length === 0 ? `<p class="muted small">No events yet.</p>` : `
        <ul class="timeline">${m.recentEvents.map((e) => `
          <li><span class="dot" aria-hidden="true"></span>
            <span class="event-type">${escapeHtml(e.type)}</span>
            <div class="event-meta">seq ${e.seq} · ${formatTime(e.recordedAt)}${e.promiseId ? ` · <a href="#/tx/${encodeURIComponent(e.promiseId)}">${escapeHtml(shortId(e.promiseId))}</a>` : ""}</div>
          </li>`).join("")}</ul>
        <p class="small"><a href="#/recorder">Open the Flight Recorder →</a></p>`}
      </div>`;
  } catch (err) {
    view().innerHTML = viewHead("Command Center", "") + errorBanner(err.message);
  }
}

/* ================================================================
   VIEW: Purchase Copilot (NL intent → offers → promise → approval)
   ================================================================ */
const copilot = { step: 1, intent: null, parsed: null, offers: [], offer: null, view: null };

function copilotStepper() {
  const steps = ["Intent", "Offers", "Promise", "Approval"];
  return `<ol class="stepper" aria-label="Purchase progress">${steps.map((label, i) => {
    const n = i + 1;
    const cls = n < copilot.step ? "done" : "";
    const current = n === copilot.step ? ' aria-current="step"' : "";
    return `<li class="${cls}"${current}><span class="step-n" aria-hidden="true">${n < copilot.step ? "✓" : n}</span><span class="step-label">${label}</span></li>`;
  }).join("")}</ol>`;
}

function renderCopilot() {
  setNav("copilot");
  const head = viewHead("Purchase Copilot", "Describe the need in plain language, compare offers, then approve the exact transaction. Parsing is heuristic and labeled; money moves only after your approval.");
  if (copilot.step === 1) {
    view().innerHTML = head + copilotStepper() + `
      <div class="card">
        <h2>1 · Describe the purchase</h2>
        <form id="intentForm">
          <div class="field">
            <label for="rawText">Purchase request</label>
            <textarea id="rawText" name="rawText" required maxlength="4000" placeholder="e.g. Purchase three field sensor kits for the Lyon warehouse, budget under $500, delivery within 14 days. Must have IP67 rating.">Purchase three field sensor kits for the Lyon warehouse, budget under $500, delivery within 14 days. Must have IP67 rating.</textarea>
            <span class="hint">Heuristic extraction is authoritative; the optional AI interpretation below is advisory only. Injection signals block execution either way.</span>
          </div>
          <div class="form-grid two-col">
            <div class="field"><label for="buyerId">Buyer id</label><input type="text" id="buyerId" name="buyerId" value="buyer-demo" maxlength="200" /></div>
            <div class="field"><label for="budgetMinor">Budget override <span class="hint">(minor units, optional)</span></label><input type="number" id="budgetMinor" name="budgetMinor" min="1" step="1" placeholder="e.g. 50000 for $500.00" /></div>
          </div>
          <div class="button-row"><button class="button" type="submit">Parse intent</button></div>
        </form>
        <div id="intentResult" class="section-gap"></div>
      </div>`;
    $("#intentForm").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const box = $("#intentResult");
      box.innerHTML = loadingState("Parsing intent…");
      try {
        const fd = new FormData(ev.target);
        const payload = { rawText: String(fd.get("rawText")), buyerId: String(fd.get("buyerId")) || "buyer-demo" };
        const override = String(fd.get("budgetMinor") || "").trim();
        if (override) payload.budgetMinor = Number.parseInt(override, 10);
        const result = await api("/api/intents", { method: "POST", body: payload });
        copilot.intent = result.intent;
        copilot.parsed = result.parsed;
        const p = result.parsed;
        box.innerHTML = `
          <h3>Parsed intent ${originPill("heuristic-parse")}</h3>
          <dl class="kv">
            <dt>Intent</dt><dd class="mono">${escapeHtml(result.intent.id)}</dd>
            <dt>Budget</dt><dd>${formatMoney(result.intent.budget)}</dd>
            <dt>Quantity</dt><dd>${result.intent.quantity} · ${escapeHtml(result.intent.categories.join(", "))}</dd>
            <dt>Deadline</dt><dd>${formatTime(result.intent.deadline)}</dd>
            <dt>Extraction notes</dt><dd class="small muted">${escapeHtml((p.notes ?? []).join(" · "))}</dd>
            ${p.injectionSignals?.length ? `<dt>Injection scan</dt><dd><span class="pill bad">SIGNALS: ${escapeHtml(p.injectionSignals.join(", "))}</span></dd>` : ""}
          </dl>
          <div id="aiIntentBox" class="section-gap"></div>
          <div class="button-row"><button class="button secondary" id="aiInterpretBtn" type="button">Interpret with AI</button><button class="button" id="toOffers">Compare offers →</button></div>`;
        $("#aiInterpretBtn").addEventListener("click", async () => {
          const abox = $("#aiIntentBox");
          abox.innerHTML = loadingState("Asking the model…");
          try {
            const r = await api("/api/ai/analyze-intent", { method: "POST", body: { rawText: payload.rawText, buyerId: payload.buyerId } });
            abox.innerHTML = aiInterpretationHtml(r);
          } catch (err) {
            abox.innerHTML = aiErrorHtml(err);
          }
        });
        $("#toOffers").addEventListener("click", () => { copilot.step = 2; renderCopilot(); void loadOffers(); });
        toast("Intent parsed", "ok");
      } catch (err) {
        box.innerHTML = errorBanner(err.message);
      }
    });
    return;
  }
  if (copilot.step === 2) {
    view().innerHTML = head + copilotStepper() + `<div class="card"><h2>2 · Compare offers</h2><div id="offerBox">${loadingState("Loading offers…")}</div></div>`;
    void loadOffers();
    return;
  }
  if (copilot.step === 3) {
    const v = copilot.view;
    view().innerHTML = head + copilotStepper() + `
      <div class="card">
        <h2>3 · Purchase promise</h2>
        ${v ? `
        <dl class="kv">
          <dt>Promise</dt><dd class="mono">${escapeHtml(v.promise.id)} · v${v.promise.version}</dd>
          <dt>Merchant</dt><dd>${escapeHtml(v.promise.merchantId)}</dd>
          <dt>Total</dt><dd><strong>${formatMoney(v.promise.total)}</strong></dd>
          <dt>Items</dt><dd>${v.promise.items.map((i) => `${escapeHtml(i.name)} × ${i.quantity}`).join("; ")}</dd>
          <dt>Delivery</dt><dd>${formatTime(v.promise.expectedDeliveryDate)}</dd>
          <dt>Integrity</dt><dd class="mono">${escapeHtml(v.promise.hash.slice(0, 24))}…</dd>
          <dt>Policy</dt><dd>${escapeHtml(v.policy.verdict)}${v.policy.reasons.length ? ` (${escapeHtml(v.policy.reasons.join(", "))})` : ""}</dd>
        </dl>
        <div class="button-row"><button class="button secondary" id="backOffers">← Offers</button><button class="button" id="toApprove">Review approval →</button></div>
        ` : `<p class="muted">No promise yet.</p>`}
      </div>`;
    $("#backOffers")?.addEventListener("click", () => { copilot.step = 2; renderCopilot(); });
    $("#toApprove")?.addEventListener("click", () => { copilot.step = 4; renderCopilot(); });
    return;
  }
  const v = copilot.view;
  view().innerHTML = head + copilotStepper() + `
    <div class="card">
      <h2>4 · Approve the exact transaction</h2>
      ${v ? `
      <p>Approve <strong>${formatMoney(v.promise.total)}</strong> to <strong>${escapeHtml(v.promise.merchantId)}</strong>. The approval binds to promise v${v.promise.version} + hash <span class="mono">${escapeHtml(v.promise.hash.slice(0, 12))}…</span> — any material change invalidates it.</p>
      <form id="approveForm">
        <div class="form-grid two-col">
          <div class="field"><label for="approvedBy">Approver identity</label><input type="text" id="approvedBy" value="buyer-demo" maxlength="200" required /></div>
          <div class="field"><label for="approveNote">Note (optional)</label><input type="text" id="approveNote" maxlength="1000" placeholder="e.g. Q4 equipment budget" /></div>
        </div>
        <div class="button-row">
          <button class="button secondary" type="button" id="declineBtn">Decline</button>
          <button class="button" type="submit">Approve ${formatMoney(v.promise.total)}</button>
        </div>
      </form>
      <div id="approveResult" class="section-gap"></div>
      ` : `<p class="muted">No promise to approve.</p>`}
    </div>`;
  $("#approveForm")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const box = $("#approveResult");
    box.innerHTML = loadingState("Requesting approval…");
    try {
      const updated = await api(`/api/promises/${encodeURIComponent(v.promise.id)}/approve`, {
        method: "POST",
        body: { approvedBy: $("#approvedBy").value, note: $("#approveNote").value || undefined },
      });
      copilot.view = updated;
      box.innerHTML = `<p>${statePill(updated.state)} Promise approved. Policy: ${escapeHtml(updated.policy.verdict)}.</p>
        <div class="button-row"><a class="button" href="#/tx/${encodeURIComponent(updated.promise.id)}">Open transaction →</a></div>`;
      toast("Promise approved", "ok");
      void refreshTopbar();
    } catch (err) {
      box.innerHTML = errorBanner(err.message);
    }
  });
  $("#declineBtn")?.addEventListener("click", async () => {
    if (!(await confirmDialog("Decline promise", "Decline this promise? This ends its lifecycle.", "Decline"))) return;
    try {
      const updated = await api(`/api/promises/${encodeURIComponent(v.promise.id)}/decline`, { method: "POST", body: { decidedBy: $("#approvedBy").value || "buyer-demo" } });
      copilot.view = updated;
      view().innerHTML = head + copilotStepper() + `<div class="card">${statePill(updated.state)}<p class="muted">Promise declined. <a href="#/copilot" id="restartLink">Start a new purchase</a>.</p></div>`;
      $("#restartLink").addEventListener("click", () => resetCopilot());
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

function resetCopilot() {
  copilot.step = 1; copilot.intent = null; copilot.parsed = null; copilot.offers = []; copilot.offer = null; copilot.view = null;
}

async function loadOffers() {
  const box = $("#offerBox");
  if (!copilot.intent) {
    if (box) box.innerHTML = emptyState("✦", "No intent yet", "Parse an intent first.", "");
    copilot.step = 1; renderCopilot();
    return;
  }
  try {
    const result = await api(`/api/offers?intentId=${encodeURIComponent(copilot.intent.id)}`);
    copilot.offers = result.offers;
    if (!box) return;
    if (result.offers.length === 0) {
      box.innerHTML = emptyState("▤", "No offers", "The catalog returned nothing for this intent.", "");
      return;
    }
    box.innerHTML = `
      <div class="badge-row" style="margin-bottom:0.8rem">${originPill(result.origin)}<span class="small muted">Live merchant discovery (Channel3) is not in this build.</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Merchant</th><th>Items</th><th class="num">Total</th><th>Delivery</th><th></th></tr></thead>
        <tbody>${result.offers.map((o) => `
          <tr>
            <td>${escapeHtml(o.merchantId)}<div class="small muted">${escapeHtml(o.terms ?? "")}</div></td>
            <td>${o.items.map((i) => `${escapeHtml(i.name)} × ${i.quantity}`).join("<br>")}</td>
            <td class="num"><strong>${formatMoney(o.total)}</strong></td>
            <td>${formatTime(o.expectedDeliveryDate)}</td>
            <td><button class="button small" data-offer="${escapeHtml(o.id)}">Select</button></td>
          </tr>`).join("")}</tbody>
      </table></div>
      <div id="promiseResult" class="section-gap"></div>`;
    box.querySelectorAll("button[data-offer]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const target = $("#promiseResult");
        target.innerHTML = loadingState("Creating promise…");
        try {
          const created = await api("/api/promises", { method: "POST", body: { intentId: copilot.intent.id, offerId: btn.dataset.offer } });
          copilot.view = created;
          copilot.step = 3;
          renderCopilot();
          toast("Promise created", "ok");
        } catch (err) {
          target.innerHTML = errorBanner(err.message);
        }
      });
    });
  } catch (err) {
    if (box) box.innerHTML = errorBanner(err.message);
  }
}

/* ================================================================
   VIEW: Transactions (list + detail)
   ================================================================ */
async function renderTxList() {
  setNav("tx");
  view().innerHTML = viewHead("Transactions", "Every purchase promise with its lifecycle state and verified money status.") + loadingState();
  try {
    const list = await api("/api/promises");
    if (list.length === 0) {
      view().innerHTML = viewHead("Transactions", "") + `<div class="card">${emptyState("▤", "No transactions yet", "Create one in the Purchase Copilot or run the flagship demo.", '<p><a class="button small" href="#/copilot">Open Purchase Copilot</a> <a class="button small secondary" href="#/demo">Open Demo Mode</a></p>')}</div>`;
      return;
    }
    view().innerHTML = viewHead("Transactions", "") + `
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Promise</th><th>Merchant</th><th class="num">Total</th><th>State</th><th>Policy</th><th>Updated</th></tr></thead>
        <tbody>${list.map((v) => `
          <tr>
            <td><a class="mono" href="#/tx/${encodeURIComponent(v.promise.id)}">${escapeHtml(shortId(v.promise.id))}</a><div class="small muted">v${v.promise.version}</div></td>
            <td>${escapeHtml(v.promise.merchantId)}</td>
            <td class="num"><strong>${formatMoney(v.promise.total)}</strong></td>
            <td>${statePill(v.state)}</td>
            <td>${escapeHtml(v.policy.verdict)}</td>
            <td class="small">${formatTime(v.promise.updatedAt)}</td>
          </tr>`).join("")}</tbody>
      </table></div></div>`;
  } catch (err) {
    view().innerHTML = viewHead("Transactions", "") + errorBanner(err.message);
  }
}

async function renderTxDetail(promiseId) {
  setNav("tx");
  view().innerHTML = viewHead("Transaction Detail", promiseId) + loadingState();
  try {
    const v = await api(`/api/promises/${encodeURIComponent(promiseId)}`);
    const [orders, outcomes, audit] = await Promise.all([
      Promise.all((v.orderIds ?? []).map((id) => api(`/api/payments/orders/${encodeURIComponent(id)}`).catch((e) => ({ error: e.message })))),
      api(`/api/outcomes?promiseId=${encodeURIComponent(promiseId)}`).catch(() => []),
      api(`/api/audit?promiseId=${encodeURIComponent(promiseId)}&limit=60`).catch(() => ({ entries: [], chainValid: true })),
    ]);
    const p = v.promise;
    view().innerHTML = viewHead("Transaction Detail", `Promise ${p.id}`) + `
      <div class="badge-row" style="margin-bottom:1rem">
        ${statePill(v.state)}
        <span class="pill ${v.policy.verdict === "Cleared" ? "ok" : v.policy.verdict === "Hold" ? "warn" : "bad"}">POLICY · ${escapeHtml(v.policy.verdict.toUpperCase())}</span>
        ${v.policy.reasons.map((r) => `<span class="pill">${escapeHtml(r)}</span>`).join("")}
      </div>
      <div class="grid two">
        <div class="card">
          <h2>Structured agreement</h2>
          <dl class="kv">
            <dt>Total</dt><dd><strong>${formatMoney(p.total)}</strong></dd>
            <dt>Merchant</dt><dd>${escapeHtml(p.merchantId)}</dd>
            <dt>Items</dt><dd>${p.items.map((i) => `${escapeHtml(i.name)} × ${i.quantity} @ ${formatMoney(i.unitPrice)}`).join("<br>")}</dd>
            <dt>Delivery</dt><dd>${formatTime(p.expectedDeliveryDate)} <span class="muted small">(±${p.tolerances.maxDelayDays}d, ${p.tolerances.maxPriceDriftBps} bps)</span></dd>
            <dt>Valid until</dt><dd>${formatTime(p.validUntil)}</dd>
            <dt>Version / hash</dt><dd class="mono">v${p.version} · ${escapeHtml(p.hash.slice(0, 20))}…</dd>
            <dt>Approval</dt><dd>${p.approval ? `${escapeHtml(p.approval.approvedBy)} · ${formatTime(p.approval.approvedAt)}` : "—"}</dd>
          </dl>
        </div>
        <div class="card">
          <h2>PayPal status</h2>
          <div id="payBox">${payBoxHtml(v, orders)}</div>
        </div>
      </div>
      <div class="grid two section-gap">
        <div class="card">
          <h2>Evidence & outcomes (${outcomes.length})</h2>
          ${outcomes.length === 0 ? `<p class="muted small">No outcomes recorded yet.</p>` : `<ul class="timeline">${outcomes.map((o) => `
            <li><span class="dot" aria-hidden="true"></span><span class="event-type">${escapeHtml(o.kind)}</span>
            <div>${escapeHtml(o.summary)}</div>
            <div class="event-meta">${formatTime(o.observedAt)} · provenance ${escapeHtml(o.provenance.source)} · confidence ${o.confidence}</div></li>`).join("")}</ul>`}
          ${(v.state === "OUTCOME_MONITORING" || v.state === "INCIDENT_DETECTED") ? `
          <h3 class="section-gap">Record outcome</h3>
          <form id="outcomeForm">
            <div class="field"><label for="oSummary">Summary</label><input type="text" id="oSummary" required maxlength="2000" placeholder="e.g. Carrier scan: 2 of 3 kits delivered" /></div>
            <div class="form-grid two-col">
              <div class="field"><label for="oQty">Delivered qty (optional)</label><input type="number" id="oQty" min="0" step="1" /></div>
              <div class="field"><label for="oSource">Provenance source</label>
                <select id="oSource"><option value="simulated-logistics">simulated-logistics</option><option value="manual">manual</option><option value="buyer-confirmation">buyer-confirmation</option></select>
              </div>
            </div>
            <div class="button-row"><button class="button small" type="submit">Record outcome</button></div>
          </form>` : ""}
        </div>
        <div class="card">
          <h2>History (${audit.total ?? audit.entries.length} events)</h2>
          ${audit.chainValid ? '<span class="pill ok">CHAIN VALID</span>' : '<span class="pill bad">CHAIN BROKEN</span>'}
          <ul class="timeline section-gap">${(audit.entries ?? []).slice(-8).reverse().map((e) => `
            <li class="${e.type.startsWith("policy.blocked") ? "blocked" : ""}"><span class="dot" aria-hidden="true"></span>
            <span class="event-type">${escapeHtml(e.type)}</span>
            <div class="event-meta">seq ${e.seq} · ${formatTime(e.recordedAt)}</div></li>`).join("")}</ul>
          <p class="small"><a href="#/twin?promiseId=${encodeURIComponent(promiseId)}">Open in Outcome Twin →</a> · <a href="#/recorder?promiseId=${encodeURIComponent(promiseId)}">Replay in Flight Recorder →</a> · <a href="/api/audit/export?promiseId=${encodeURIComponent(promiseId)}" download>Download redacted export</a></p>
        </div>
      </div>
      <div id="txActionResult" class="section-gap"></div>`;

    wireTxActions(v, orders);
    $("#outcomeForm")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try {
        const payload = {};
        const qty = $("#oQty").value;
        if (qty !== "") payload.deliveredQuantity = Number.parseInt(qty, 10);
        const result = await api("/api/outcomes", { method: "POST", body: {
          promiseId: p.id, kind: "delivery-scan", summary: $("#oSummary").value,
          payload, provenance: { source: $("#oSource").value }, confidence: $("#oSource").value === "simulated-logistics" ? 1 : 0.8,
        } });
        toast(result.incidents.length > 0 ? `Outcome recorded — ${result.incidents.length} incident(s) detected` : "Outcome recorded — no gaps", result.incidents.length > 0 ? "error" : "ok");
        void renderTxDetail(promiseId);
        void refreshTopbar();
      } catch (err) {
        toast(err.message, "error");
      }
    });
  } catch (err) {
    view().innerHTML = viewHead("Transaction Detail", "") + errorBanner(err.message);
  }
}

function payBoxHtml(v, orders) {
  const rows = orders.map((o) => o.error
    ? `<p class="small muted">Order lookup failed: ${escapeHtml(o.error)}</p>`
    : `<dl class="kv" style="margin-bottom:0.8rem">
        <dt>Order</dt><dd class="mono">${escapeHtml(shortId(o.order.id))} · provider ${escapeHtml(o.order.providerOrderId ?? "—")}</dd>
        <dt>Status</dt><dd>${escapeHtml(o.order.status)} ${originPill(o.transport)}</dd>
        <dt>Amount</dt><dd>${formatMoney(o.order.amount)}</dd>
        ${o.order.approveUrl ? `<dt>Approve URL</dt><dd><a href="${escapeHtml(o.order.approveUrl)}" target="_blank" rel="noopener">open PayPal approval</a></dd>` : ""}
      </dl>`).join("");
  let actions = "";
  if (v.state === "APPROVED") actions += `<button class="button small" id="createOrderBtn">Create PayPal order</button>`;
  for (const o of orders) {
    if (o.error) continue;
    if (o.order.status === "created") actions += ` <button class="button small secondary" data-buyer-approve="${escapeHtml(o.order.id)}">Simulate buyer approval</button>`;
    if (o.order.status === "approved") actions += ` <button class="button small" data-capture="${escapeHtml(o.order.id)}">Capture ${formatMoney(o.order.amount)}</button>`;
    actions += ` <button class="button small secondary" data-refresh="${escapeHtml(o.order.id)}">Refresh status</button>`;
  }
  return `${rows || `<p class="muted small">No PayPal orders yet.${v.state === "APPROVED" ? " Create one to start payment." : ""}</p>`}
    ${actions ? `<div class="button-row">${actions}</div><p class="small muted">Buyer-approval simulation exists only for the mock transport; live sandbox orders require the real PayPal approval URL.</p>` : ""}`;
}

function wireTxActions(v, orders) {
  $("#createOrderBtn")?.addEventListener("click", async () => {
    try {
      const result = await api("/api/payments/orders", { method: "POST", body: { promiseId: v.promise.id } });
      toast(result.duplicate ? "Order replayed (idempotent)" : `Order created: ${result.order.providerOrderId ?? result.order.id}`, "ok");
      void renderTxDetail(v.promise.id);
      void refreshTopbar();
    } catch (err) {
      toast(err.message, "error");
    }
  });
  document.querySelectorAll("[data-buyer-approve]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(`/api/payments/orders/${encodeURIComponent(btn.dataset.buyerApprove)}/buyer-approve`, { method: "POST", body: {} });
        toast("Buyer approval simulated", "ok");
        void renderTxDetail(v.promise.id);
        void refreshTopbar();
      } catch (err) {
        toast(err.message, "error");
      }
    });
  });
  document.querySelectorAll("[data-capture]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!(await confirmDialog("Capture payment", "Capture this PayPal order now? Funds move at the provider.", "Capture"))) return;
      try {
        await api(`/api/payments/orders/${encodeURIComponent(btn.dataset.capture)}/capture`, { method: "POST", body: {} });
        toast("Payment captured", "ok");
        void renderTxDetail(v.promise.id);
        void refreshTopbar();
      } catch (err) {
        toast(err.message, "error");
      }
    });
  });
  document.querySelectorAll("[data-refresh]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const result = await api(`/api/payments/orders/${encodeURIComponent(btn.dataset.refresh)}?refresh=1`);
        toast(`Provider status: ${result.order.status}`, "ok");
        void renderTxDetail(v.promise.id);
      } catch (err) {
        toast(err.message, "error");
      }
    });
  });
  void orders;
}

/* ---------- AI interpretation fragments (model proposes, code decides) ---------- */
function aiOriginPill(origin) {
  return originPill(String(origin ?? "").startsWith("ai-model:") ? "ai-live" : "ai-off");
}

function aiFallbackNote(origin) {
  if (String(origin ?? "").startsWith("ai-model:")) return "";
  return `<p class="small">Live model unavailable on this box — see <a href="#/ai-gallery">RECORDED VERIFIED AI RUNs in the AI Evidence gallery →</a></p>`;
}

function aiProvenanceLine(r) {
  const prov = r.provenance ?? {};
  const tokens = (prov.promptTokens ?? 0) + (prov.completionTokens ?? 0);
  return `${r.origin ?? "?"}${tokens ? ` · ${tokens} tok · ${prov.latencyMs ?? "?"} ms` : ""}`;
}

function aiInterpretationHtml(r) {
  const c = r.constraints ?? {};
  const budget = c.budgetMinor == null ? "no budget" : formatMoney({ currency: c.currency ?? "USD", amountMinor: c.budgetMinor });
  const list = (arr) => (arr ?? []).length ? escapeHtml(arr.join("; ")) : "—";
  return `<div class="card" style="border-style:dashed"><h3>AI purchase interpretation ${aiOriginPill(r.origin)}</h3>
    <dl class="kv">
      <dt>Constraints</dt><dd class="small">qty ${escapeHtml(String(c.quantity ?? "?"))} · budget ${escapeHtml(budget)} · ${escapeHtml(c.productType ?? "any type")} · ${c.deadlineDays == null ? "no deadline" : `${escapeHtml(String(c.deadlineDays))} day(s)`}</dd>
      <dt>Requirements</dt><dd class="small">${list(r.requirements)}</dd>
      <dt>Ambiguities</dt><dd class="small">${list(r.ambiguities)}</dd>
      <dt>Trade-offs</dt><dd class="small">${list(r.tradeoffs)}</dd>
      <dt>Provenance</dt><dd class="small muted mono">${escapeHtml(aiProvenanceLine(r))}</dd>
    </dl>
    ${aiFallbackNote(r.origin)}
    <p class="small muted">Advisory only — the heuristic parse above stays authoritative for offer search, and injection signals still block execution.</p></div>`;
}

function aiAnalysisHtml(r) {
  const gaps = (r.gaps ?? []).map((g) => `<span class="pill">${escapeHtml(g.category)} · ${escapeHtml(g.severity)}</span>`).join("");
  return `<div class="card" style="border-style:dashed"><h3>AI incident analysis ${aiOriginPill(r.origin)}</h3>
    <p class="small">${escapeHtml(r.interpretation ?? "—")}</p>
    ${gaps ? `<div class="badge-row">${gaps}</div>` : ""}
    <p class="small">Model category: <span class="pill">${escapeHtml(r.category ?? "?")}</span>${r.categoryGated ? ' <span class="pill warn">GATED · REPLACED BY DETECTION</span>' : ""}</p>
    ${(r.citations ?? []).length ? `<p class="small muted">Cited evidence: ${r.citations.map((x) => `<span class="mono">${escapeHtml(x)}</span>`).join(", ")}</p>` : ""}
    ${(r.droppedCitations ?? []).length ? `<p class="small"><span class="pill warn">DROPPED ${r.droppedCitations.length} UNGROUNDED CITATION(S)</span></p>` : ""}
    <p class="small muted">Uncertainty: ${escapeHtml(r.uncertainty ?? "?")} · escalation ${r.escalate ? "recommended" : "not needed"} · deterministic detection stays authoritative</p>
    <p class="small muted mono">${escapeHtml(aiProvenanceLine(r))}</p>
    ${aiFallbackNote(r.origin)}</div>`;
}

function recoveryProposalHtml(r, currency) {
  const gate = r.gate ?? {};
  const gateCls = gate.verdict === "approved-as-proposed" ? "ok" : gate.verdict === "needs-human" ? "warn" : "bad";
  return `<div class="card" style="border-style:dashed"><h3>AI recovery proposal ${aiOriginPill(r.origin)}</h3>
    <dl class="kv"><dt>Strategy</dt><dd><strong>${escapeHtml(r.strategy ?? "?")}</strong></dd>
    <dt>Amount</dt><dd>${r.amountMinor == null ? "—" : formatMoney({ currency, amountMinor: r.amountMinor })}</dd>
    <dt>Rationale</dt><dd class="small">${escapeHtml(r.rationale ?? "")}</dd>
    <dt>Gate</dt><dd><span class="pill ${gateCls}">${escapeHtml(String(gate.verdict ?? "?").toUpperCase())}</span> <span class="small muted">${escapeHtml(gate.reason ?? "")}</span></dd>
    <dt>Confidence</dt><dd class="small">${escapeHtml(r.confidence ?? "?")}</dd>
    ${(r.risks ?? []).length ? `<dt>Risks</dt><dd class="small">${escapeHtml(r.risks.join("; "))}</dd>` : ""}
    <dt>Approvals</dt><dd class="small">${escapeHtml((r.requiredApprovals ?? []).join(", ") || "—")}</dd>
    <dt>Provenance</dt><dd class="small muted mono">${escapeHtml(aiProvenanceLine(r))}</dd></dl>
    ${aiFallbackNote(r.origin)}
    <p class="small muted">The model proposes; the gate and your approval decide. Nothing moved yet — approve a proposal below to execute.</p></div>`;
}

/* ================================================================
   VIEW: Recovery Center
   ================================================================ */
async function renderRecovery() {
  setNav("recovery");
  view().innerHTML = viewHead("Recovery Center", "Diagnose incidents, propose resolutions, approve them, and verify the money moved.") + loadingState();
  try {
    const [incidents, proposals] = await Promise.all([api("/api/incidents"), api("/api/resolutions")]);
    const open = incidents.filter((i) => i.status === "open" || i.status === "triaged" || i.status === "resolving");
    const byIncident = new Map();
    for (const p of proposals) {
      if (!byIncident.has(p.incidentId)) byIncident.set(p.incidentId, []);
      byIncident.get(p.incidentId).push(p);
    }
    view().innerHTML = viewHead("Recovery Center", "") + `
      ${open.length === 0 ? `<div class="card">${emptyState("⛨", "No open incidents", "Incidents appear here when outcome detection finds a promise-vs-reality gap.", "")}</div>` : open.map((i) => `
      <div class="card" style="margin-bottom:1rem">
        <div class="badge-row">
          <span class="pill ${i.severity === "critical" || i.severity === "high" ? "bad" : "warn"}">${escapeHtml(i.severity.toUpperCase())}</span>
          <span class="pill">${escapeHtml(i.category)}</span>
          <span class="pill info">${escapeHtml(i.status.toUpperCase())}</span>
          <span class="small muted mono">${escapeHtml(shortId(i.id))} · detected ${formatTime(i.detectedAt)} by ${escapeHtml(i.detectedBy)}</span>
        </div>
        <p>${escapeHtml(shortDetail(i.detail))}</p>
        <p class="small"><a href="#/tx/${encodeURIComponent(i.promiseId)}">Open transaction →</a></p>
        <div class="button-row">
          <button class="button small secondary" data-ai-analyze="${escapeHtml(i.id)}" data-promise="${escapeHtml(i.promiseId)}" data-detail="${escapeHtml(i.detail.slice(0, 500))}">Analyze with AI</button>
          <button class="button small secondary" data-ai-propose="${escapeHtml(i.id)}" data-promise="${escapeHtml(i.promiseId)}">AI recovery proposal</button>
        </div>
        <div data-ai-result="${escapeHtml(i.id)}" class="section-gap"></div>
        ${(byIncident.get(i.id) ?? []).map((p) => `
          <div class="table-wrap" style="margin-bottom:0.6rem"><table>
            <tbody><tr>
              <td><strong>${escapeHtml(p.kind)}</strong><div class="small muted">${escapeHtml(p.rationale)}</div><div class="small muted">by ${escapeHtml(p.proposedBy)} · ${formatTime(p.proposedAt)}</div></td>
              <td class="num">${p.amount ? formatMoney(p.amount) : "—"}</td>
              <td style="white-space:nowrap">
                <button class="button small" data-res-approve="${escapeHtml(p.id)}">Approve & execute</button>
                <button class="button small secondary" data-res-reject="${escapeHtml(p.id)}">Reject</button>
              </td>
            </tr></tbody>
          </table></div>`).join("")}
        <details>
          <summary class="small" style="cursor:pointer">Propose a resolution</summary>
          <form data-propose="${escapeHtml(i.id)}" class="section-gap">
            <div class="form-grid two-col">
              <div class="field"><label>Kind<select name="kind">
                <option value="refund-partial">refund-partial</option><option value="refund-full">refund-full</option>
                <option value="replacement">replacement</option><option value="credit">credit</option>
                <option value="escalate">escalate</option><option value="dismiss">dismiss</option>
              </select></label></div>
              <div class="field"><label>Amount <span class="hint">(minor units, refunds only)</span><input type="number" name="amountMinor" min="1" step="1" /></label></div>
            </div>
            <div class="field"><label>Rationale<input type="text" name="rationale" required maxlength="4000" placeholder="Why this fix matches the evidence" /></label></div>
            <div class="button-row"><button class="button small" type="submit">Submit proposal</button></div>
          </form>
        </details>
      </div>`).join("")}
      <div id="recoveryResult"></div>`;

    document.querySelectorAll("[data-propose]").forEach((form) => {
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const fd = new FormData(form);
        const kind = String(fd.get("kind"));
        const body = { incidentId: form.dataset.propose, kind, rationale: String(fd.get("rationale")), proposedBy: "operator" };
        const amountRaw = String(fd.get("amountMinor") || "").trim();
        if (amountRaw) {
          const incident = open.find((x) => x.id === form.dataset.propose);
          const tx = await api(`/api/promises/${encodeURIComponent(incident.promiseId)}`);
          body.amount = { currency: tx.promise.total.currency, amountMinor: Number.parseInt(amountRaw, 10) };
        }
        try {
          await api("/api/resolutions", { method: "POST", body });
          toast("Proposal submitted", "ok");
          void renderRecovery();
          void refreshTopbar();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
    const decide = async (id, decision) => {
      if (!(await confirmDialog(decision === "approved" ? "Approve & execute" : "Reject proposal",
        decision === "approved" ? "Approve this resolution? Refunds execute immediately at the provider." : "Reject this proposal? The promise lifecycle ends as declined.",
        decision === "approved" ? "Approve & execute" : "Reject"))) return;
      try {
        const result = await api(`/api/resolutions/${encodeURIComponent(id)}/decide`, { method: "POST", body: { decidedBy: "operator", decision } });
        toast(`Resolution ${decision}: ${result.state}`, decision === "approved" ? "ok" : "info");
        void renderRecovery();
        void refreshTopbar();
      } catch (err) {
        toast(err.message, "error");
      }
    };
    document.querySelectorAll("[data-res-approve]").forEach((b) => b.addEventListener("click", () => decide(b.dataset.resApprove, "approved")));
    document.querySelectorAll("[data-res-reject]").forEach((b) => b.addEventListener("click", () => decide(b.dataset.resReject, "rejected")));
    document.querySelectorAll("[data-ai-analyze]").forEach((b) => b.addEventListener("click", async () => {
      const box = document.querySelector(`[data-ai-result="${b.dataset.aiAnalyze}"]`);
      box.innerHTML = loadingState("Asking the model…");
      try {
        const r = await api("/api/ai/analyze-incident", { method: "POST", body: { promiseId: b.dataset.promise, observation: { note: b.dataset.detail } } });
        box.innerHTML = aiAnalysisHtml(r);
      } catch (err) {
        box.innerHTML = aiErrorHtml(err);
      }
    }));
    document.querySelectorAll("[data-ai-propose]").forEach((b) => b.addEventListener("click", async () => {
      const box = document.querySelector(`[data-ai-result="${b.dataset.aiPropose}"]`);
      box.innerHTML = loadingState("Asking the model…");
      try {
        const [r, tx] = await Promise.all([
          api("/api/ai/plan-recovery", { method: "POST", body: { incidentId: b.dataset.aiPropose } }),
          api(`/api/promises/${encodeURIComponent(b.dataset.promise)}`),
        ]);
        box.innerHTML = recoveryProposalHtml(r, tx.promise.total.currency);
      } catch (err) {
        box.innerHTML = aiErrorHtml(err);
      }
    }));
  } catch (err) {
    view().innerHTML = viewHead("Recovery Center", "") + errorBanner(err.message);
  }
}

/* ================================================================
   VIEW: Flight Recorder
   ================================================================ */
const recorder = { entries: [], index: 0, chainValid: true, total: 0, promiseId: "", type: "" };

async function renderRecorder(initialPromiseId = "") {
  setNav("recorder");
  recorder.promiseId = initialPromiseId;
  view().innerHTML = viewHead("Flight Recorder", "Chronological, hash-chained execution record. Replay state transitions, verify integrity, export a redacted evidence bundle.") + `
    <div class="card">
      <form id="auditFilter" class="form-grid two-col">
        <div class="field"><label for="fPromise">Promise id <span class="hint">(optional)</span></label><input type="text" id="fPromise" value="${escapeHtml(initialPromiseId)}" placeholder="filter to one promise" /></div>
        <div class="field"><label for="fType">Event type <span class="hint">(optional)</span></label><input type="text" id="fType" placeholder="e.g. policy.blocked" /></div>
      </form>
      <div class="button-row">
        <button class="button small" id="auditLoad">Load events</button>
        <a class="button small secondary" id="auditExport" href="/api/audit/export" download>Download redacted export</a>
      </div>
    </div>
    <div class="card section-gap" id="replayCard" hidden>
      <h2>Replay</h2>
      <div class="button-row" style="margin-top:0">
        <button class="button small secondary" id="replayPrev">← Prev</button>
        <button class="button small secondary" id="replayNext">Next →</button>
        <span class="small muted" id="replayPos"></span>
      </div>
      <div id="replayBox" class="section-gap"></div>
    </div>
    <div class="card section-gap"><div id="auditBox">${loadingState("Loading events…")}</div></div>`;
  $("#auditLoad").addEventListener("click", () => {
    recorder.promiseId = $("#fPromise").value.trim();
    recorder.type = $("#fType").value.trim();
    void loadAudit();
  });
  $("#auditFilter").addEventListener("submit", (ev) => { ev.preventDefault(); $("#auditLoad").click(); });
  $("#replayPrev").addEventListener("click", () => { if (recorder.index > 0) { recorder.index -= 1; renderReplay(); } });
  $("#replayNext").addEventListener("click", () => { if (recorder.index < recorder.entries.length - 1) { recorder.index += 1; renderReplay(); } });
  void loadAudit();
}

async function loadAudit() {
  const box = $("#auditBox");
  box.innerHTML = loadingState("Loading events…");
  try {
    const params = new URLSearchParams({ limit: "300" });
    if (recorder.promiseId) params.set("promiseId", recorder.promiseId);
    if (recorder.type) params.set("type", recorder.type);
    const result = await api(`/api/audit?${params.toString()}`);
    recorder.entries = result.entries;
    recorder.chainValid = result.chainValid;
    recorder.total = result.total;
    recorder.index = result.entries.length - 1;
    const exportLink = $("#auditExport");
    exportLink.href = recorder.promiseId ? `/api/audit/export?promiseId=${encodeURIComponent(recorder.promiseId)}` : "/api/audit/export";
    if (result.entries.length === 0) {
      box.innerHTML = emptyState("◉", "No events", "Nothing matches this filter yet.", "");
      $("#replayCard").hidden = true;
      return;
    }
    box.innerHTML = `
      <div class="badge-row" style="margin-bottom:0.8rem">
        ${result.chainValid ? '<span class="pill ok">CHAIN VALID</span>' : '<span class="pill bad">CHAIN BROKEN</span>'}
        <span class="pill">${result.total} event(s)</span>
      </div>
      <ul class="timeline">${result.entries.map((e) => `
        <li class="${e.type === "policy.blocked" ? "blocked" : ""}"><span class="dot" aria-hidden="true"></span>
          <span class="event-type">${escapeHtml(e.type)}</span>
          <div class="event-meta">seq ${e.seq} · ${formatTime(e.recordedAt)}${e.actor ? ` · by ${escapeHtml(e.actor)}` : ""}${e.promiseId ? ` · <a href="#/tx/${encodeURIComponent(e.promiseId)}">${escapeHtml(shortId(e.promiseId))}</a>` : ""}</div>
          <div class="small muted mono">hash ${escapeHtml(e.hash.slice(0, 16))}… ← ${escapeHtml(String(e.prevHash).slice(0, 16))}…</div>
          <details class="event-payload"><summary>payload</summary><pre class="payload">${escapeHtml(JSON.stringify(e.payload, null, 2))}</pre></details>
        </li>`).join("")}</ul>`;
    $("#replayCard").hidden = false;
    renderReplay();
  } catch (err) {
    box.innerHTML = errorBanner(err.message);
  }
}

function renderReplay() {
  const box = $("#replayBox");
  const pos = $("#replayPos");
  const e = recorder.entries[recorder.index];
  if (!e) { box.innerHTML = ""; return; }
  pos.textContent = `event ${recorder.index + 1} of ${recorder.entries.length} (seq ${e.seq})`;
  box.innerHTML = `
    <span class="event-type">${escapeHtml(e.type)}</span>
    <div class="event-meta">${formatTime(e.recordedAt)}${e.actor ? ` · by ${escapeHtml(e.actor)}` : ""}</div>
    <div class="small muted mono">seq ${e.seq} · hash ${escapeHtml(e.hash.slice(0, 24))}… · prev ${escapeHtml(String(e.prevHash).slice(0, 24))}…</div>
    <pre class="payload">${escapeHtml(JSON.stringify(e.payload, null, 2))}</pre>`;
}

/* ================================================================
   VIEW: Developer Center
   ================================================================ */
async function renderDeveloper() {
  setNav("developer");
  view().innerHTML = viewHead("Developer Center", "API health, sandbox configuration, integration status, and safe test tools.") + loadingState();
  try {
    const [health, config] = await Promise.all([api("/api/health"), api("/api/config")]);
    const feats = config.features ?? {};
    const featRow = (name, value) => `<tr><td>${escapeHtml(name)}</td><td>${originPill(value)}</td></tr>`;
    view().innerHTML = viewHead("Developer Center", "") + `
      <div class="grid two">
        <div class="card">
          <h2>API health</h2>
          <dl class="kv">
            <dt>Status</dt><dd>${escapeHtml(health.status)} · v${escapeHtml(health.version)}</dd>
            <dt>Time</dt><dd>${formatTime(health.time)}</dd>
            <dt>Transport</dt><dd>${originPill(health.transport)}</dd>
            <dt>Audit chain</dt><dd>${health.auditChainValid ? "valid" : "BROKEN"} (${health.auditEntries} entries)</dd>
            <dt>Kill-switch</dt><dd>${health.killSwitch ? "ENGAGED" : "off"}</dd>
            <dt>Demo reset</dt><dd>${health.resetAllowed ? "allowed (mock mode)" : "refused (live mode)"}</dd>
          </dl>
        </div>
        <div class="card">
          <h2>Sandbox configuration</h2>
          <dl class="kv">
            <dt>Mode</dt><dd>${escapeHtml(config.paypal.mode)}</dd>
            <dt>API base</dt><dd class="mono">${escapeHtml(config.paypal.apiBase)}</dd>
            <dt>Client id</dt><dd>${config.paypal.clientIdPresent ? "present (redacted)" : "absent → mock transport"}</dd>
            <dt>Client secret</dt><dd>${config.paypal.clientSecretPresent ? "present (redacted)" : "absent → mock transport"}</dd>
            <dt>Webhook id</dt><dd>${config.paypal.webhookIdPresent ? "configured" : "not configured"}</dd>
            <dt>Allow live</dt><dd>${String(config.paypal.allowLive)}</dd>
            <dt>Max amount</dt><dd>${config.policy.maxAmountMinor} minor units</dd>
          </dl>
        </div>
      </div>
      <div class="grid two section-gap">
        <div class="card">
          <h2>Integration status</h2>
          <div class="table-wrap"><table><tbody>
            ${featRow("Offer catalog", feats.catalog)}${featRow("Logistics events", feats.logistics)}
            ${featRow("Intent parsing", feats.nlParse)}${featRow("Studio analytics", feats.agStudio)}
            ${featRow("Channel3 discovery", feats.channel3)}${featRow("Recovery scheduling", feats.bryntum)}
          </tbody></table></div>
          <p class="small muted">Values name the exact implementation (“ag-grid-community”, “live”/“unconfigured”, “fallback-timeline”) — never the unclaimed product. Unconfigured cells never render fake data.</p>
        </div>
        <div class="card">
          <h2>Test tools</h2>
          <p class="small muted">Kill-switch control is exposed only in mock-simulated mode. Reads, webhooks, and reconciliation stay open while engaged.</p>
          <div class="button-row">
            <button class="button small ${health.killSwitch ? "secondary" : "danger"}" id="killBtn">${health.killSwitch ? "Disengage kill-switch" : "Engage kill-switch"}</button>
          </div>
          <h3 class="section-gap">Endpoint reference</h3>
          <div class="table-wrap"><table>
            <thead><tr><th>Method</th><th>Path</th></tr></thead>
            <tbody>${["GET /api/health", "GET /api/config", "GET /api/metrics", "POST /api/intents", "GET /api/offers?intentId=", "POST /api/promises", "POST /api/promises/:id/approve", "POST /api/payments/orders", "POST /api/payments/orders/:id/capture", "POST /api/outcomes", "POST /api/resolutions", "POST /api/resolutions/:id/decide", "GET /api/audit", "GET /api/audit/export", "POST /api/demo/run", "POST /api/demo/runs/:id/reset", "POST /api/demo/reset"]
              .map((e) => { const [m, p] = e.split(" "); return `<tr><td class="mono">${m}</td><td class="mono">${p}</td></tr>`; }).join("")}
            ${( ["GET /api/discovery/status", "POST /api/discovery/search", "POST /api/discovery/compare", "GET /api/studio/datasets", "POST /api/studio/command", "GET /api/timeline?promiseId="])
              .map((e) => { const [m, p] = e.split(" "); return `<tr><td class="mono">${m}</td><td class="mono">${p}</td></tr>`; }).join("")}</tbody>
          </table></div>
        </div>
      </div>`;
    $("#killBtn").addEventListener("click", async () => {
      const engaged = !health.killSwitch;
      if (!(await confirmDialog(engaged ? "Engage kill-switch" : "Disengage kill-switch",
        engaged ? "Refuse all new payment operations? Reads and webhooks stay open." : "Re-allow payment operations?",
        engaged ? "Engage" : "Disengage"))) return;
      try {
        await api("/api/admin/kill-switch", { method: "POST", body: { engaged, actor: "developer-console" } });
        toast(`Kill-switch ${engaged ? "engaged" : "disengaged"}`, engaged ? "error" : "ok");
        void renderDeveloper();
        void refreshTopbar();
      } catch (err) {
        toast(err.message, "error");
      }
    });
  } catch (err) {
    view().innerHTML = viewHead("Developer Center", "") + errorBanner(err.message);
  }
}

/* ================================================================
   VIEW: Demo / Jury Mode
   ================================================================ */
/* Per-run reset tokens for runs started in this browser (in-memory only;
   tokens do not survive reload or server restart by design). */
const demoTokens = new Map();
async function renderDemo() {
  setNav("demo");
  view().innerHTML = viewHead("Demo / Jury Mode", "Reproducible scenarios with honest real-vs-simulated markers. Reset is available only where it is safe.") + loadingState();
  try {
    const [config, runs] = await Promise.all([api("/api/config"), api("/api/demo/runs")]);
    view().innerHTML = viewHead("Demo / Jury Mode", "") + `
      <div class="card">
        <h2>Provenance legend</h2>
        <div class="legend"><ul>
          <li>${originPill("real-api")} <span>Executed by this build’s API against real domain/policy/payment code.</span></li>
          <li>${originPill("paypal-sandbox-live")} <span>Real PayPal Sandbox HTTPS call (only with credentials).</span></li>
          <li>${originPill("mock-simulated")} <span>Deterministic in-process PayPal simulation. Labeled everywhere.</span></li>
          <li>${originPill("simulated-logistics")} <span>Scripted carrier event. Detection logic is real; the carrier is not.</span></li>
          <li>${originPill("heuristic-parse")} <span>Deterministic regex/keyword extraction used for this step (the AI Evidence gallery holds recorded verified model runs).</span></li>
          <li>${originPill("not-in-build")} <span>Capability explicitly absent. Never faked.</span></li>
        </ul></div>
      </div>
      <div class="grid two section-gap">
        <div class="card">
          <h2>Flagship: “The Purchase That Went Wrong”</h2>
          <p class="small muted">Acts 1–9: intent → discovery → approval → payment → incident → resolution → verified recovery → flight recorder → sponsor intelligence. Deterministic: 3 × $129.99, short delivery of 1, partial refund of $129.99.</p>
          <div class="button-row"><button class="button" id="runFlagship">Run flagship scenario</button></div>
        </div>
        <div class="card">
          <h2>Negative: prompt-injection block</h2>
          <p class="small muted">A malicious description attempts a merchant swap and an amount increase. The deterministic policy engine must refuse both; the Flight Recorder keeps the evidence.</p>
          <div class="button-row"><button class="button secondary" id="runInjection">Run injection scenario</button></div>
        </div>
      </div>
      <div class="card section-gap">
        <h2>Safe reset</h2>
        <p class="small muted">Runs you start in this browser carry a reset token: use “Reset this run” on the run card to delete only its records (other visitors’ runs are untouched; the audit chain is append-only so past entries stay). ${config.resetAllowed ? "Global reset clears ALL local records including the audit chain, then records demo.reset as the new genesis event — operator token required on shared boxes." : "Global reset is refused outside mock-simulated mode to protect live sandbox records."}</p>
        <div class="button-row"><button class="button danger" id="demoReset" ${config.resetAllowed ? "" : "disabled"}>Reset demo data</button></div>
      </div>
      <div id="demoResult" class="section-gap"></div>
      <div class="card section-gap">
        <h2>Past runs (${runs.length})</h2>
        ${runs.length === 0 ? `<p class="muted small">No runs yet.</p>` : `<div class="table-wrap"><table>
          <thead><tr><th>Run</th><th>Scenario</th><th>Status</th><th>Acts</th><th>Started</th></tr></thead>
          <tbody>${runs.slice().reverse().map((r) => `<tr>
            <td><button class="button small secondary" data-run="${escapeHtml(r.id)}">${escapeHtml(shortId(r.id))}</button></td>
            <td>${escapeHtml(r.scenario)}</td><td>${escapeHtml(r.status)}</td><td>${r.acts.length}</td><td class="small">${formatTime(r.startedAt)}</td>
          </tr>`).join("")}</tbody></table></div>`}
      </div>`;

    const showRun = (run) => {
      const box = $("#demoResult");
      const ownToken = demoTokens.get(run.id);
      box.innerHTML = `<div class="card">
        <h2>Run ${escapeHtml(shortId(run.id))} · ${escapeHtml(run.scenario)} · ${escapeHtml(run.status.toUpperCase())}</h2>
        <div class="badge-row" style="margin-bottom:0.8rem">${originPill(run.transport === "paypal-sandbox-live" ? "paypal-sandbox-live" : "mock-simulated")}${ownToken !== undefined && config.resetAllowed ? `<button class="button small secondary" id="resetThisRun">Reset this run</button>` : ""}</div>
        ${run.needsAction ? `<div class="error-banner"><strong>Action needed:</strong> approve the live PayPal order, then continue. <a href="${escapeHtml(run.needsAction.approveUrl)}" target="_blank" rel="noopener">Open PayPal approval</a>
          <div class="button-row"><button class="button small" id="continueRun">Continue after approval</button></div></div>` : ""}
        ${run.error ? errorBanner(run.error) : ""}
        ${run.acts.map((a) => `
          <div class="act ${a.status}">
            <div class="act-head"><strong>Act ${a.act} · ${escapeHtml(a.title)}</strong>${originPill(a.origin)}
            <span class="pill ${a.status === "passed" ? "ok" : a.status === "blocked" ? "bad" : a.status === "awaiting" ? "warn" : ""}">${escapeHtml(a.status.toUpperCase())}</span></div>
            <p class="act-detail">${escapeHtml(a.detail)}</p>
            ${Object.keys(a.refIds ?? {}).length ? `<div class="small muted">refs: ${Object.entries(a.refIds).map(([k, v]) => `${escapeHtml(k)}=${k.toLowerCase().includes("promise") || k === "promiseId" ? `<a href="#/tx/${encodeURIComponent(v)}">${escapeHtml(shortId(v))}</a>` : `<span class="mono">${escapeHtml(shortId(v))}</span>`}`).join(" · ")}</div>` : ""}
          </div>`).join("")}
      </div>`;
      box.scrollIntoView({ block: "start" });
      $("#continueRun")?.addEventListener("click", async () => {
        try {
          const updated = await api(`/api/demo/runs/${encodeURIComponent(run.id)}/continue`, { method: "POST", body: { token: demoTokens.get(run.id) } });
          showRun(updated);
          void refreshTopbar();
        } catch (err) {
          toast(err.message, "error");
        }
      });
      $("#resetThisRun")?.addEventListener("click", async () => {
        if (!(await confirmDialog("Reset this run", "Delete only this run's records? Other visitors' runs are untouched; audit entries stay (append-only).", "Reset this run"))) return;
        try {
          const result = await api(`/api/demo/runs/${encodeURIComponent(run.id)}/reset`, { method: "POST", body: { token: demoTokens.get(run.id) } });
          demoTokens.delete(run.id);
          toast(`Run reset: ${Object.values(result.cleared).reduce((a, b) => a + b, 0)} records cleared`, "ok");
          void renderDemo();
          void refreshTopbar();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    };

    $("#runFlagship").addEventListener("click", async () => {
      $("#demoResult").innerHTML = loadingState("Running flagship scenario (Acts 1–9)…");
      try {
        const run = await api("/api/demo/run", { method: "POST", body: { scenario: "flagship", label: "jury-demo" } });
        if (typeof run.resetToken === "string") demoTokens.set(run.id, run.resetToken);
        showRun(run);
        void refreshTopbar();
      } catch (err) {
        $("#demoResult").innerHTML = errorBanner(err.message);
      }
    });
    $("#runInjection").addEventListener("click", async () => {
      $("#demoResult").innerHTML = loadingState("Running injection scenario…");
      try {
        const run = await api("/api/demo/run", { method: "POST", body: { scenario: "injection", label: "jury-negative" } });
        if (typeof run.resetToken === "string") demoTokens.set(run.id, run.resetToken);
        showRun(run);
        void refreshTopbar();
      } catch (err) {
        $("#demoResult").innerHTML = errorBanner(err.message);
      }
    });
    $("#demoReset").addEventListener("click", async () => {
      if (!(await confirmDialog("Reset demo data", "Clear ALL local records (promises, payments, audit chain)? Only available in mock mode.", "Reset everything"))) return;
      try {
        const result = await api("/api/demo/reset", { method: "POST", body: {} });
        toast(`Reset complete: ${Object.values(result.cleared).reduce((a, b) => a + b, 0)} records cleared`, "ok");
        void renderDemo();
        void refreshTopbar();
      } catch (err) {
        toast(err.message, "error");
      }
    });
    document.querySelectorAll("[data-run]").forEach((b) => {
      b.addEventListener("click", async () => {
        try {
          showRun(await api(`/api/demo/runs/${encodeURIComponent(b.dataset.run)}`));
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
  } catch (err) {
    view().innerHTML = viewHead("Demo / Jury Mode", "") + errorBanner(err.message);
  }
}

/* ================================================================
   VIEW: Judge Mode (30-second guided entry for hackathon judges)
   Frontend-only: runs the same flagship/injection scenarios through
   POST /api/demo/run and cites recorded sandbox artifacts. No new
   backend paths, no simulated-as-live presentation.
   ================================================================ */
async function renderJudge() {
  setNav("judge");
  view().innerHTML = viewHead("A successful payment is not a successful purchase.", "AFTERPACT verifies whether an AI-initiated purchase actually delivered what was promised — and safely resolves the gap.") + loadingState();
  let config;
  try {
    config = await api("/api/config");
  } catch (err) {
    view().innerHTML = viewHead("Judge Mode", "") + errorBanner(err.message);
    return;
  }
  const transportPill = originPill(config.transport === "paypal-sandbox-live" ? "paypal-sandbox-live" : "mock-simulated");
  view().innerHTML = viewHead("A successful payment is not a successful purchase.", "AFTERPACT verifies whether an AI-initiated purchase actually delivered what was promised — and safely resolves the gap.") + `
    <div class="badge-row section-gap">${transportPill}<span class="pill">DEMO MODE: ${escapeHtml(String(config.transport).toUpperCase())}</span></div>
    <p class="judge-lifecycle">Promise → Payment → Observation → Recovery → Proof</p>
    <div class="button-row section-gap"><a class="button" href="#/judge" id="judgeRun">Run the flagship scenario</a><a class="button secondary" href="#/recorder">Explore the evidence</a></div>
    <div class="grid three section-gap">
      <div class="card" data-scenario-card="flagship">
        <h2>Scenario 1 — Short delivery</h2>
        <p class="small muted">Three kits promised, two delivered. AFTERPACT detects the gap, proposes a bounded partial refund, requires approval, and verifies the provider result.</p>
        <div class="button-row"><button class="button small" data-judge-run="flagship">Run short-delivery scenario</button></div>
      </div>
      <div class="card" data-scenario-card="injection">
        <h2>Scenario 2 — Blocked attack</h2>
        <p class="small muted">A hostile description attempts a merchant swap and an amount increase. The deterministic policy must refuse both — AFTERPACT knows when NOT to act.</p>
        <div class="button-row"><button class="button small secondary" data-judge-run="injection">Run refusal scenario</button></div>
      </div>
      <div class="card" data-scenario-card="receipts">
        <h2>Scenario 3 — Provider-verified proof</h2>
        <div class="badge-row">${originPill("recorded-sandbox")}</div>
        <p class="small muted">Two independent PayPal Sandbox loops, recorded with credentials redacted (sandbox test money, never live):</p>
        <ul class="small mono"><li>Loop 1 (partial)<br />order <span style="white-space:nowrap">2ER387580K033722V</span><br />capture <span style="white-space:nowrap">7R158417X9367771B</span><br />refund <span style="white-space:nowrap">8DJ895035B173303G</span></li>
        <li>Loop 2 (full)<br />order <span style="white-space:nowrap">59A94150344824111</span><br />capture <span style="white-space:nowrap">72S38593LS000452A</span><br />refund <span style="white-space:nowrap">15T12360RX6158212</span></li></ul>
        <p class="small muted">Artifacts: <span class="mono">docs/demo/paypal-live-receipts.json</span> + <span class="mono">paypal-live-receipts-2.json</span>.</p>
      </div>
    </div>
    <div id="judgeResult" class="section-gap"></div>
    <div class="card section-gap"><h2>Technical evidence</h2>
      <p class="small"><a href="#/ai-gallery">AI Evidence Gallery →</a> · <a href="#/recorder">Flight Recorder →</a> · <a href="#/twin">Outcome Twin →</a> · <a href="#/developer">Developer Center →</a></p></div>`;

  const showJudgeRun = (run) => {
    const promiseId = run.context?.promiseId ?? run.context?.promiseA ?? "";
    $("#judgeResult").innerHTML = `<div class="card">
      <h2>Run ${escapeHtml(shortId(run.id))} · ${escapeHtml(run.scenario)} · ${escapeHtml(String(run.status).toUpperCase())}</h2>
      <div class="badge-row" style="margin-bottom:0.8rem">${originPill(run.transport === "paypal-sandbox-live" ? "paypal-sandbox-live" : "mock-simulated")}</div>
      ${run.error ? errorBanner(run.error) : ""}
      <div data-judge-acts>
      ${run.acts.map((a) => `
        <div class="act ${a.status}" data-act-status="${escapeHtml(a.status)}">
          <div class="act-head"><strong>Act ${a.act} · ${escapeHtml(a.title)}</strong>${originPill(a.origin)}
          <span class="pill ${a.status === "passed" ? "ok" : a.status === "blocked" ? "bad" : ""}">${escapeHtml(a.status.toUpperCase())}</span>${a.status === "blocked" ? `<span class="pill bad">REFUSED</span>` : ""}</div>
          <p class="act-detail">${escapeHtml(a.detail)}</p>
        </div>`).join("")}
      </div>
      ${promiseId ? `<p class="small"><a href="#/twin?promiseId=${encodeURIComponent(promiseId)}">Open in Outcome Twin →</a> · <a href="#/recorder?promiseId=${encodeURIComponent(promiseId)}">Replay in Flight Recorder →</a> · <a href="#/tx/${encodeURIComponent(promiseId)}">Transaction →</a></p>` : ""}
    </div>`;
    $("#judgeResult").scrollIntoView({ block: "start" });
  };

  const runScenario = async (scenario) => {
    $("#judgeResult").innerHTML = loadingState(`Running ${scenario} scenario…`);
    try {
      const run = await api("/api/demo/run", { method: "POST", body: { scenario, label: "judge-mode" } });
      if (typeof run.resetToken === "string") demoTokens.set(run.id, run.resetToken);
      showJudgeRun(run);
      void refreshTopbar();
    } catch (err) {
      $("#judgeResult").innerHTML = errorBanner(err.message);
    }
  };

  $("#judgeRun").addEventListener("click", (ev) => { ev.preventDefault(); void runScenario("flagship"); });
  document.querySelectorAll("[data-judge-run]").forEach((b) => {
    b.addEventListener("click", () => void runScenario(b.dataset.judgeRun));
  });
}

/* ================================================================
   VIEW: Intelligence Studio (AG Studio canvas + agent, Community tables)
   The canvas is real AG Studio (official CDN, SRI-pinned, trial
   watermark until a licence key is configured). Tables below use AG
   Grid Community (vendored, MIT) when available, with an honest
   native-table fallback.
   ================================================================ */
const studio = { datasets: null, entity: "incidents", crossPromiseId: null, nl: null, gridApi: null, api: null };

function agAvailable() {
  return typeof window.agGrid !== "undefined" && typeof window.agGrid.createGrid === "function";
}

function agThemeClass() {
  return document.documentElement.dataset.theme === "light" ? "ag-theme-quartz" : "ag-theme-quartz-dark";
}

function destroyStudioGrid() {
  if (studio.gridApi) {
    try { studio.gridApi.destroy(); } catch { /* already gone */ }
    studio.gridApi = null;
  }
  if (studio.api) {
    try { studio.api.destroy(); } catch { /* already gone */ }
    studio.api = null;
  }
}

function loadScriptOnce(src, integrity) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-lazy="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.dataset.lazy = src;
    el.async = false;
    if (integrity) {
      el.integrity = integrity;
      el.crossOrigin = "anonymous";
    }
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(el);
  });
}

// AG Studio is commercial (EULA forbids redistribution), so the browser
// loads the pinned bytes from the OFFICIAL AG Grid channel first; the
// same-origin copy (fetched at build time, gitignored) is only a fallback
// for offline judges and deterministic CI. Both are SHA-pinned to 3.1.0.
const AG_STUDIO_VERSION = "3.1.0";
const AG_STUDIO_CDN = `https://cdn.jsdelivr.net/npm/ag-studio@${AG_STUDIO_VERSION}/dist/umd/ag-studio.min.js`;
const AG_STUDIO_SRI = "sha384-AQulWK/PF30iLAso56dIH/1+Iv852aUbFC98K7N1ZpLYVvmamIEAU36dEbUaPym1";
const AG_STUDIO_LOCAL = "/vendor/ag-studio.min.js";

async function loadAgStudioBundle() {
  try {
    await loadScriptOnce(AG_STUDIO_CDN, AG_STUDIO_SRI);
    if (window.agStudio) return "official-cdn";
  } catch {
    /* fall through to the build-time local copy */
  }
  await loadScriptOnce(AG_STUDIO_LOCAL);
  if (!window.agStudio) throw new Error("AG Studio bundle loaded but window.agStudio is missing");
  return "local-fallback";
}

// Commerce Intelligence Studio — Signature theme. Built with the official
// createStudioTheme/studioTheme.withParams API (AG Studio 3.1.0): one palette
// per app mode, matched 1:1 to the AFTERPACT CSS variables in styles.css so
// the canvas reads as a native part of the product, not an embedded tool.
function buildAfterpactStudioTheme() {
  const S = window.agStudio;
  if (!S || typeof S.studioTheme?.withParams !== "function") return null;
  const dark = document.documentElement.dataset.theme !== "light";
  const shared = {
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    fontSize: 14,
    borderRadius: 8,
    spacing: 8,
  };
  const palette = dark ? {
    browserColorScheme: "dark",
    backgroundColor: "#11151f",
    foregroundColor: "#e8edf5",
    chromeBackgroundColor: "#070a10",
    headerBackgroundColor: "#070a10",
    borderColor: "#232b3b",
    accentColor: "#2dd4bf",
  } : {
    browserColorScheme: "light",
    backgroundColor: "#ffffff",
    foregroundColor: "#141a26",
    chromeBackgroundColor: "#e9edf3",
    headerBackgroundColor: "#e9edf3",
    borderColor: "#d4dbe6",
    accentColor: "#0d9488",
  };
  return S.studioTheme.withParams(
    { ...shared, ...palette },
    dark ? "afterpact-studio-dark" : "afterpact-studio-light",
  );
}

async function mountAgStudio(datasets) {
  const host = $("#agStudioHost");
  if (!host) return;
  try {
    const config = await api("/api/config");
    if (config.agStudio && config.agStudio.enabled === false) {
      host.innerHTML = `<p class="small muted">AG Studio canvas disabled on this box (consent fallback). The Community tables below stay fully functional.</p>`;
      return;
    }
    await loadAgStudioBundle();
    await loadScriptOnce("/ag-studio-adapter.js");
    syncAgStudioThemeMode();
    const key = config.agStudio && typeof config.agStudio.licenseKey === "string" ? config.agStudio.licenseKey : null;
    if (key) {
      window.agStudio.AgStudioLicenseManager.setLicenseKey(key);
    }
    const pill = $("#studioLicensePill");
    if (pill) {
      pill.className = `pill ${key ? "ok" : "warn"}`;
      pill.textContent = key ? "AG STUDIO · LICENSED" : "AG STUDIO · TRIAL WATERMARK";
    }
    window.agStudio.AgStudioModuleRegistry.registerModules([window.agStudio.AgStudioAiModule]);
    destroyStudioGrid();
    const adapter = window.AfterpactStudioAdapter.createVultrStudioAdapter("/api/ai/studio-turn");
    const signatureTheme = buildAfterpactStudioTheme();
    studio.api = window.agStudio.createStudio(host, {
      ...(signatureTheme ? { theme: signatureTheme } : {}),
      data: {
        sources: [
          { id: "promises", data: datasets.promises ?? [] },
          { id: "incidents", data: datasets.incidents ?? [] },
          { id: "captures", data: datasets.captures ?? [] },
          { id: "refunds", data: datasets.refunds ?? [] },
        ],
      },
      mode: "edit",
      ai: ({ api: studioApi }) => window.agStudio.createAiHarness(studioApi, {
        adapter,
        promptStarters: [
          { label: "Open incidents by severity", prompt: "Show a bar chart of open incidents grouped by severity, using the incidents source." },
          { label: "Refund recovery rate", prompt: "Create a KPI tile with the refunded-to-captured rate plus a table of refunds by status." },
          { label: "At-risk promises", prompt: "List promises with open incidents and unrefunded balances in a grid, sorted by amount at risk." },
        ],
      }),
    });
  } catch (err) {
    host.innerHTML = `<p class="small muted">AG Studio canvas unavailable: ${escapeHtml(err.message)}. The Community tables below stay fully functional.</p>`;
  }
}

const STUDIO_COLUMNS = {
  incidents: [
    { field: "id", headerName: "Incident", flex: 1, minWidth: 130, cellRenderer: (p) => `<span class="mono">${escapeHtml(shortId(p.value))}</span>` },
    { field: "status", headerName: "Status", width: 120 },
    { field: "severity", headerName: "Severity", width: 105 },
    { field: "category", headerName: "Category", width: 140 },
    { field: "promiseUnrefundedMinor", headerName: "Unrefunded", width: 130, valueFormatter: (p) => formatMoney({ currency: p.data.currency ?? "USD", amountMinor: p.value ?? 0 }) },
    { field: "proposedRefundMinor", headerName: "Proposed", width: 130, valueFormatter: (p) => formatMoney({ currency: p.data.currency ?? "USD", amountMinor: p.value ?? 0 }) },
    { field: "ageHours", headerName: "Age (h)", width: 95 },
    { field: "proposalCount", headerName: "Props", width: 80 },
    { field: "detectedBy", headerName: "Detected by", width: 120 },
  ],
  promises: [
    { field: "id", headerName: "Promise", flex: 1, minWidth: 130, cellRenderer: (p) => `<span class="mono">${escapeHtml(shortId(p.value))}</span>` },
    { field: "state", headerName: "State", width: 220 },
    { field: "merchantId", headerName: "Merchant", width: 200 },
    { field: "totalMinor", headerName: "Total", width: 125, valueFormatter: (p) => formatMoney({ currency: p.data.currency, amountMinor: p.value }) },
    { field: "openIncidentCount", headerName: "Open inc", width: 100 },
    { field: "evidenceCount", headerName: "Ev", width: 70 },
    { field: "evidenceRequired", headerName: "Ev req", width: 80 },
  ],
  refunds: [
    { field: "id", headerName: "Refund", flex: 1, minWidth: 130, cellRenderer: (p) => `<span class="mono">${escapeHtml(shortId(p.value))}</span>` },
    { field: "status", headerName: "Status", width: 120 },
    { field: "amountMinor", headerName: "Amount", width: 125, valueFormatter: (p) => formatMoney({ currency: p.data.currency, amountMinor: p.value }) },
    { field: "reason", headerName: "Reason", flex: 2, minWidth: 200 },
    { field: "createdAt", headerName: "Created", width: 170, valueFormatter: (p) => formatTime(p.value) },
  ],
  captures: [
    { field: "id", headerName: "Capture", flex: 1, minWidth: 130, cellRenderer: (p) => `<span class="mono">${escapeHtml(shortId(p.value))}</span>` },
    { field: "status", headerName: "Status", width: 150 },
    { field: "amountMinor", headerName: "Amount", width: 125, valueFormatter: (p) => formatMoney({ currency: p.data.currency, amountMinor: p.value }) },
    { field: "remainingMinor", headerName: "Remaining", width: 125, valueFormatter: (p) => formatMoney({ currency: p.data.currency, amountMinor: p.value }) },
    { field: "capturedAt", headerName: "Captured", width: 170, valueFormatter: (p) => formatTime(p.value) },
  ],
};

function studioRows() {
  if (!studio.datasets) return [];
  let rows = studio.datasets[studio.entity] ?? [];
  if (studio.entity === "incidents" && studio.crossPromiseId) {
    rows = rows.filter((r) => r.promiseId === studio.crossPromiseId);
  }
  return rows;
}

function renderNativeTable(host, columns, rows) {
  if (rows.length === 0) {
    host.innerHTML = emptyState("▦", "No rows", "The current filter matches nothing. Adjust the NL command or clear the cross-filter.");
    return;
  }
  host.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr>${columns.map((c) => `<th scope="col">${escapeHtml(c.headerName)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr data-row-id="${escapeHtml(row.id)}">${columns.map((c) => {
    let text = row[c.field];
    if (c.valueFormatter) {
      try { text = c.valueFormatter({ value: row[c.field], data: row }); } catch { text = row[c.field]; }
    }
    return `<td>${escapeHtml(text ?? "—")}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderStudioGrid() {
  destroyStudioGrid();
  const host = $("#studioGrid");
  const badge = $("#studioRenderer");
  if (!host) return;
  const columns = STUDIO_COLUMNS[studio.entity];
  const rows = studioRows();
  const chip = studio.crossPromiseId && studio.entity === "incidents"
    ? `<p><span class="pill info">CROSS-FILTER · promise ${escapeHtml(shortId(studio.crossPromiseId))}</span> <button class="button small secondary" id="clearCross">Clear</button></p>`
    : "";
  $("#studioCross").innerHTML = chip;
  $("#clearCross")?.addEventListener("click", () => { studio.crossPromiseId = null; renderStudioGrid(); });
  if (agAvailable()) {
    if (badge) badge.innerHTML = originPill("ag-grid-community");
    host.innerHTML = `<div id="studioGridInner" class="${agThemeClass()} ag-grid-host"></div>`;
    const inner = $("#studioGridInner");
    studio.gridApi = window.agGrid.createGrid(inner, {
      columnDefs: columns,
      rowData: rows,
      pagination: true,
      paginationPageSize: 15,
      paginationPageSizeSelector: [15, 30, 50],
      animateRows: false,
      onRowClicked: (ev) => {
        if (studio.entity === "promises" && ev.data) {
          studio.crossPromiseId = ev.data.id;
          studio.entity = "incidents";
          document.querySelectorAll("[data-studio-entity]").forEach((b) => b.classList.toggle("secondary", b.dataset.studioEntity !== "incidents"));
          renderStudioGrid();
          toast(`Cross-filter: incidents for promise ${shortId(ev.data.id)}`, "ok");
        }
      },
    });
  } else {
    if (badge) badge.innerHTML = originPill("native-table");
    renderNativeTable(host, columns, rows);
    host.querySelectorAll("tr[data-row-id]").forEach((tr) => {
      tr.addEventListener("click", () => {
        if (studio.entity === "promises") {
          studio.crossPromiseId = tr.dataset.rowId;
          studio.entity = "incidents";
          document.querySelectorAll("[data-studio-entity]").forEach((b) => b.classList.toggle("secondary", b.dataset.studioEntity !== "incidents"));
          renderStudioGrid();
        }
      });
    });
  }
}

function renderNlResult() {
  const host = $("#nlResult");
  if (!host) return;
  if (!studio.nl) {
    host.innerHTML = `<p class="muted small">No command run yet. Try <button class="linklike" data-nl-example="incidents unresolved refunds &gt;$100">incidents unresolved refunds &gt;$100</button> or <button class="linklike" data-nl-example="promises state APPROVED">promises state APPROVED</button>.</p>`;
  } else if (studio.nl.error) {
    host.innerHTML = errorBanner(studio.nl.error) + (studio.nl.hint ? `<p class="small"><strong>Hint:</strong> ${escapeHtml(studio.nl.hint)}</p>` : "");
  } else {
    const r = studio.nl;
    host.innerHTML = `<p><span class="pill ok">${r.total} ROW${r.total === 1 ? "" : "S"}</span> <span class="muted small">${escapeHtml(r.explanation)}</span></p>
      <div class="table-wrap"><table class="data-table"><thead><tr>${Object.keys(r.rows[0] ?? { result: 0 }).slice(0, 8).map((k) => `<th scope="col">${escapeHtml(k)}</th>`).join("")}</tr></thead>
      <tbody>${r.rows.slice(0, 25).map((row) => `<tr>${Object.entries(row).slice(0, 8).map(([, v]) => `<td>${escapeHtml(typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")).slice(0, 80)}</td>`).join("")}</tr>`).join("") || `<tr><td>No rows matched.</td></tr>`}</tbody></table></div>`;
  }
  host.querySelectorAll("[data-nl-example]").forEach((b) => {
    b.addEventListener("click", () => { $("#nlCommand").value = b.dataset.nlExample; $("#nlForm").requestSubmit(); });
  });
}

function breakdownList(record) {
  const entries = Object.entries(record ?? {});
  if (entries.length === 0) return `<p class="muted small">None yet.</p>`;
  const max = Math.max(...entries.map(([, v]) => v));
  return `<ul class="bars">${entries.sort((a, b) => b[1] - a[1]).map(([k, v]) => `
    <li><span class="bar-label">${escapeHtml(k)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.round((v / max) * 100)}%"></span></span><strong>${v}</strong></li>`).join("")}</ul>`;
}

async function renderStudio() {
  setNav("studio");
  destroyStudioGrid();
  view().innerHTML = viewHead("Commerce Intelligence Studio", "AG Studio canvas + AI agent over live API rows, with the Community tables and strict NL command box below.") + loadingState();
  try {
    const datasets = await api("/api/studio/datasets");
    studio.datasets = datasets;
    const k = datasets.kpis;
    const refundRate = k.refundRateBps === null ? "—" : `${(k.refundRateBps / 100).toFixed(2)}%`;
    view().innerHTML = viewHead("Commerce Intelligence Studio", "AG Studio canvas + AI agent over live API rows, with the Community tables and strict NL command box below.") + `
      <div class="badge-row section-gap">${originPill("real-api")} <span id="studioRenderer"></span><span class="pill" id="studioLicensePill">AG STUDIO · …</span></div>
      <div class="card section-gap"><h2>AG Studio canvas</h2>
        <div id="agStudioHost" style="min-height:640px">${loadingState("Loading AG Studio…")}</div>
        <p class="small muted section-gap">Drag-and-drop canvas over the live promises, incidents, captures, and refunds sources. The AI assistant (chat panel) runs on our own model via <span class="mono">/api/ai/studio-turn</span> — the inference key never leaves the server.</p>
      </div>
      <div class="grid kpi">
        <div class="card"><div class="kpi-value">${k.promiseCount}</div><div class="kpi-label">Promises</div><div class="kpi-sub">${Object.entries(k.promisesByState).map(([s, n]) => `${s} ${n}`).join(" · ") || "none"}</div></div>
        <div class="card"><div class="kpi-value">${k.openIncidentCount}</div><div class="kpi-label">Open incidents</div><div class="kpi-sub">${k.unresolvedRefundIncidentCount} with unresolved refunds</div></div>
        <div class="card"><div class="kpi-value">${formatMoney({ currency: "USD", amountMinor: k.capturedMinor })}</div><div class="kpi-label">Captured</div><div class="kpi-sub">refunded ${formatMoney({ currency: "USD", amountMinor: k.refundedMinor })} · rate ${refundRate}</div></div>
        <div class="card"><div class="kpi-value">${formatMoney({ currency: "USD", amountMinor: k.atRiskMinor })}</div><div class="kpi-label">Amount at risk</div><div class="kpi-sub">unresolved refunds ${formatMoney({ currency: "USD", amountMinor: k.unresolvedRefundMinor })}</div></div>
        <div class="card"><div class="kpi-value">${k.evidenceCollected}/${k.evidenceRequired}</div><div class="kpi-label">Evidence completeness</div><div class="kpi-sub">${k.outcomeCount} outcomes observed</div></div>
      </div>
      <div class="grid two section-gap">
        <div class="card"><h2>NL command</h2>
          <form id="nlForm"><div class="field"><label for="nlCommand">Filter the live datasets</label>
          <input type="text" id="nlCommand" maxlength="500" placeholder='e.g. incidents unresolved refunds >$100' autocomplete="off" /></div>
          <div class="button-row"><button class="button small" type="submit">Run</button></div></form>
          <div id="nlResult" class="section-gap"></div>
        </div>
        <div class="card"><h2>Incident mix</h2><h3>By severity</h3>${breakdownList(k.incidentsBySeverity)}<h3 class="section-gap">By category</h3>${breakdownList(k.incidentsByCategory)}</div>
      </div>
      <div class="card section-gap"><h2>Datasets</h2>
        <div class="button-row" role="tablist" aria-label="Studio datasets">
          ${["incidents", "promises", "refunds", "captures"].map((e) => `<button class="button small${studio.entity === e ? "" : " secondary"}" data-studio-entity="${e}" role="tab" aria-selected="${studio.entity === e}"${e} (${(datasets[e] ?? []).length})</button>`).join("")}
        </div>
        <div id="studioCross" class="section-gap"></div>
        <div id="studioGrid"></div>
        <p class="small muted section-gap">Tip: click a promise row to cross-filter its incidents. Tables follow the app theme (toggle ◐ in the top bar).</p>
      </div>`;
    renderNlResult();
    renderStudioGrid();
    void mountAgStudio(datasets);
    document.querySelectorAll("[data-studio-entity]").forEach((b) => {
      b.addEventListener("click", () => {
        studio.entity = b.dataset.studioEntity;
        document.querySelectorAll("[data-studio-entity]").forEach((x) => x.classList.toggle("secondary", x !== b));
        renderStudioGrid();
      });
    });
    $("#nlForm").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const command = $("#nlCommand").value.trim();
      if (!command) return;
      try {
        studio.nl = await api("/api/studio/command", { method: "POST", body: { command } });
      } catch (err) {
        studio.nl = { error: err.message, hint: "Examples: incidents unresolved refunds >$100 · promises state APPROVED · refunds currency USD" };
      }
      renderNlResult();
    });
  } catch (err) {
    view().innerHTML = viewHead("Commerce Intelligence Studio", "") + errorBanner(err.message);
  }
}

/* ================================================================
   VIEW: Discovery (Channel3 live search)
   ================================================================ */
const discovery = { status: null, search: null, compare: null, lookup: null };

function availabilityPill(availability) {
  if (availability === "in_stock") return `<span class="pill ok">IN STOCK</span>`;
  if (availability === "out_of_stock") return `<span class="pill bad">OUT OF STOCK</span>`;
  return `<span class="pill warn">AVAILABILITY UNKNOWN</span>`;
}

function candidateCard(c) {
  const offers = (c.offers ?? []).map((o) => `
    <tr><td>${escapeHtml(o.merchant)}</td>
    <td>${o.priceMinor === null ? '<span class="muted">price unknown</span>' : formatMoney({ currency: o.currency ?? "USD", amountMinor: o.priceMinor })}</td>
    <td>${availabilityPill(o.availability)}</td>
    <td>${o.url ? `<a href="${escapeHtml(o.url)}" target="_blank" rel="noopener nofollow">merchant link</a>` : "—"}</td></tr>`).join("");
  return `<div class="card section-gap"><div class="badge-row">${originPill("channel3-live")}<span class="pill">${escapeHtml(c.offerCount)} OFFERS</span></div>
    <h2 class="section-gap">${escapeHtml(c.title)}</h2>
    <p class="muted small">Channel3 product <span class="mono">${escapeHtml(c.productId)}</span>${c.brand ? ` · brand ${escapeHtml(c.brand)}` : ""} · best known price ${c.bestPriceMinor === null ? "unknown" : formatMoney({ currency: c.bestPriceCurrency ?? "USD", amountMinor: c.bestPriceMinor })}</p>
    ${c.offers.length === 0 ? `<p class="muted small">No merchant offers returned for this product.</p>` : `<div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Merchant</th><th scope="col">Price</th><th scope="col">Availability</th><th scope="col">Link</th></tr></thead><tbody>${offers}</tbody></table></div>`}
    <p class="small muted">Attribution: Channel3 search “${escapeHtml(c.attribution.query)}” · ${formatTime(c.attribution.searchedAt)} · locale ${escapeHtml(c.attribution.locale.country)}/${escapeHtml(c.attribution.locale.currency)}. ${escapeHtml(c.attribution.checkoutNote)}</p>
  </div>`;
}

async function renderDiscovery() {
  setNav("discovery");
  view().innerHTML = viewHead("Discovery", "Live Channel3 product search with normalization, comparison, and attribution. Without an API key this view says so — it never fabricates results.") + loadingState();
  try {
    discovery.status = await api("/api/discovery/status");
    const s = discovery.status;
    const searchHtml = discovery.search
      ? `<p><span class="pill ok">${discovery.search.candidates.length} CANDIDATES</span> <span class="muted small">${discovery.search.meta.latencyMs}ms · locale ${escapeHtml(discovery.search.meta.locale.country)}/${escapeHtml(discovery.search.meta.locale.currency)}</span></p>
         ${discovery.search.candidates.map(candidateCard).join("") || emptyState("⌕", "No candidates", "Channel3 returned zero products for that query.")}`
      : `<p class="muted small">No search run yet.</p>`;
    const compareHtml = discovery.compare
      ? `${(discovery.compare.failures ?? []).map((f) => `<p><span class="pill bad">FAILED</span> <span class="mono">${escapeHtml(f.productId)}</span> <span class="muted small">${escapeHtml(f.error).slice(0, 160)}</span></p>`).join("")}
         ${(discovery.compare.comparison.warnings ?? []).map((w) => `<p><span class="pill warn">NOTE</span> <span class="small">${escapeHtml(w)}</span></p>`).join("")}
         ${(discovery.compare.comparison.groups ?? []).map((g) => `<h3>${escapeHtml(g.currency)} — ranked by price</h3><div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Product</th><th scope="col">Merchant</th><th scope="col">Price</th><th scope="col">Availability</th></tr></thead><tbody>
           ${g.rows.map((r) => `<tr><td>${escapeHtml(r.candidate.title)}</td><td>${escapeHtml(r.offer.merchant)}</td><td>${formatMoney({ currency: r.offer.currency ?? g.currency, amountMinor: r.offer.priceMinor ?? 0 })}</td><td>${availabilityPill(r.offer.availability)}</td></tr>`).join("")}</tbody></table></div>`).join("")}`
      : `<p class="muted small">No comparison run yet.</p>`;
    view().innerHTML = viewHead("Discovery", "Live Channel3 product search with normalization, comparison, and attribution. Without an API key this view says so — it never fabricates results.") + `
      <div class="card"><h2>Status</h2>
        <div class="badge-row">${s.configured ? originPill("channel3-live") : originPill("channel3-unavailable")}</div>
        <p class="small section-gap">${escapeHtml(s.reason)} Base <span class="mono">${escapeHtml(s.baseUrl)}</span> · locale ${escapeHtml(s.country)}/${escapeHtml(s.currency)}/${escapeHtml(s.language)} · timeout ${escapeHtml(String(s.timeoutMs))}ms. Docs: <a href="${escapeHtml(s.docs)}" target="_blank" rel="noopener">docs.trychannel3.com</a></p>
      </div>
      <div class="card section-gap"><h2>Search</h2>
        <form id="searchForm"><div class="form-grid two-col">
          <div class="field"><label for="q">Query</label><input type="text" id="q" required maxlength="500" placeholder="e.g. field sensor kit IP67" /></div>
          <div class="field"><label for="mode">Mode</label><select id="mode"><option value="default">default</option><option value="agentic">agentic (slower, LLM-planned)</option></select></div>
          <div class="field"><label for="limit">Limit (1–25)</label><input type="number" id="limit" min="1" max="25" value="8" /></div>
          <div class="field"><label for="maxPrice">Max price USD (optional)</label><input type="number" id="maxPrice" min="1" step="0.01" placeholder="e.g. 150" /></div>
        </div><div class="button-row"><button class="button small" type="submit"${s.configured ? "" : " disabled"}>Search live</button></div></form>
        <div id="searchResults" class="section-gap">${searchHtml}</div>
      </div>
      <div class="card section-gap"><h2>Compare (2–6 product ids)</h2>
        <form id="compareForm"><div class="field"><label for="ids">Channel3 product ids, comma- or line-separated</label><input type="text" id="ids" placeholder="prod_abc123, prod_def456" /></div>
        <div class="button-row"><button class="button small secondary" type="submit"${s.configured ? "" : " disabled"}>Compare live</button></div></form>
        <div id="compareResults" class="section-gap">${compareHtml}</div>
      </div>
      <div class="card section-gap"><h2>Merchant URL lookup</h2>
        <form id="lookupForm"><div class="field"><label for="lookupUrl">Merchant product URL</label><input type="url" id="lookupUrl" maxlength="2000" placeholder="https://merchant.example.com/products/…" /></div>
        <div class="button-row"><button class="button small secondary" type="submit"${s.configured ? "" : " disabled"}>Look up</button></div></form>
        <div id="lookupResults" class="section-gap">${discovery.lookup ? candidateCard(discovery.lookup) : `<p class="muted small">No lookup run yet.</p>`}</div>
      </div>`;
    $("#searchForm")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try {
        const maxPrice = $("#maxPrice").value;
        discovery.search = await api("/api/discovery/search", { method: "POST", body: {
          query: $("#q").value, limit: Number.parseInt($("#limit").value, 10) || 8, mode: $("#mode").value,
          ...(maxPrice !== "" ? { maxPriceMinor: Math.round(Number.parseFloat(maxPrice) * 100) } : {}),
        } });
      } catch (err) {
        toast(err.message, "error");
        discovery.search = null;
      }
      void renderDiscovery();
      void refreshTopbar();
    });
    $("#compareForm")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try {
        const ids = $("#ids").value.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
        discovery.compare = await api("/api/discovery/compare", { method: "POST", body: { productIds: ids } });
      } catch (err) {
        toast(err.message, "error");
        discovery.compare = null;
      }
      void renderDiscovery();
      void refreshTopbar();
    });
    $("#lookupForm")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try {
        discovery.lookup = await api("/api/discovery/lookup", { method: "POST", body: { url: $("#lookupUrl").value } });
      } catch (err) {
        toast(err.message, "error");
        discovery.lookup = null;
      }
      void renderDiscovery();
      void refreshTopbar();
    });
  } catch (err) {
    view().innerHTML = viewHead("Discovery", "") + errorBanner(err.message);
  }
}

/* ================================================================
   VIEW: Recovery Timeline (dependency-aware fallback, real data)
   ================================================================ */
const timelineUi = { promiseId: "", timeline: null, promises: [] };

const TL_STATUS_CLASS = { done: "tl-done", active: "tl-active", upcoming: "tl-upcoming", overdue: "tl-overdue", blocked: "tl-blocked" };

function timelineSvg(t) {
  const tasks = t.tasks;
  const W = 1000;
  const LABEL_W = 210;
  const ROW_H = 38;
  const TOP = 34;
  const starts = tasks.map((x) => Date.parse(x.start));
  const ends = tasks.map((x) => Date.parse(x.end));
  const min = Math.min(...starts, Date.now()) - 86400000;
  const max = Math.max(...ends, Date.now()) + 86400000;
  const span = Math.max(1, max - min);
  const x = (iso) => LABEL_W + ((Date.parse(iso) - min) / span) * (W - LABEL_W - 20);
  const H = TOP + tasks.length * ROW_H + 26;
  const byId = Object.fromEntries(tasks.map((task, i) => [task.id, i]));
  const deps = tasks.flatMap((task, i) => (task.dependsOn ?? []).filter((d) => byId[d] !== undefined).map((d) => {
    const j = byId[d];
    const x1 = x(tasks[j].end);
    const y1 = TOP + j * ROW_H + ROW_H / 2;
    const x2 = x(task.start);
    const y2 = TOP + i * ROW_H + ROW_H / 2;
    return `<path d="M ${x1} ${y1} C ${x1 + 18} ${y1}, ${x2 - 18} ${y2}, ${x2 - 4} ${y2}" class="tl-dep" marker-end="url(#tlArrow)" />`;
  })).join("");
  const todayX = Date.now() >= min && Date.now() <= max ? `<line x1="${x(new Date().toISOString())}" y1="${TOP - 10}" x2="${x(new Date().toISOString())}" y2="${H - 20}" class="tl-today" /><text x="${x(new Date().toISOString()) + 4}" y="${TOP - 12}" class="tl-today-label">today</text>` : "";
  const rows = tasks.map((task, i) => {
    const y = TOP + i * ROW_H;
    const x1 = x(task.start);
    const x2 = Math.max(x1 + 6, x(task.end));
    const cls = TL_STATUS_CLASS[task.status] ?? "tl-upcoming";
    const shifted = task.shiftedByIncident ? ` ⚠+${task.shiftedByIncident.daysShifted}d` : "";
    const tip = `${task.label} — ${task.status} — ${task.start.slice(0, 10)} → ${task.end.slice(0, 10)}${task.shiftedByIncident ? ` — shifted by ${task.shiftedByIncident.incidentId}: ${task.shiftedByIncident.reason}` : ""} — ${task.note}`;
    return `<text x="8" y="${y + ROW_H / 2 + 5}" class="tl-label">${escapeHtml(task.label)}${shifted ? `<tspan class="tl-shift"> ⚠</tspan>` : ""}</text>
      <rect x="${x1}" y="${y + 8}" width="${x2 - x1}" height="20" rx="5" class="tl-bar ${cls}${task.shiftedByIncident ? " tl-shifted" : ""}"><title>${escapeHtml(tip)}</title></rect>
      <text x="${x2 + 6}" y="${y + ROW_H / 2 + 5}" class="tl-date">${escapeHtml(task.end.slice(5, 10))}${escapeHtml(shifted)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="tl-svg" role="img" aria-label="Recovery timeline for promise ${escapeHtml(t.promiseId)}">
    <defs><marker id="tlArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="tl-arrow" /></marker></defs>
    ${deps}${todayX}${rows}</svg>`;
}

async function renderTimeline(promiseId = "") {
  setNav("timeline");
  view().innerHTML = viewHead("Recovery Timeline", "Dependency-aware recovery schedule computed from live promise state. Fallback renderer (no Bryntum license in this build) — incident shifts are real recomputation, not animation.") + loadingState();
  try {
    const [promises, config] = await Promise.all([api("/api/promises"), api("/api/config")]);
    timelineUi.promises = promises;
    const selected = promiseId || timelineUi.promiseId || promises[0]?.promise?.id || "";
    timelineUi.promiseId = selected;
    timelineUi.timeline = selected ? await api(`/api/timeline?promiseId=${encodeURIComponent(selected)}`) : null;
    const t = timelineUi.timeline;
    view().innerHTML = viewHead("Recovery Timeline", "Dependency-aware recovery schedule computed from live promise state. Fallback renderer (no Bryntum license in this build) — incident shifts are real recomputation, not animation.") + `
      <div class="badge-row section-gap">${originPill("real-api")} ${originPill("fallback-timeline")} <span class="pill">BRYNTUM: ${escapeHtml(String((config.features ?? {}).bryntum ?? "fallback-timeline")).toUpperCase()}</span></div>
      <div class="card"><h2>Promise</h2>
        <form id="tlForm"><div class="field"><label for="tlPromise">Select a promise</label>
        <select id="tlPromise">${promises.map((p) => `<option value="${escapeHtml(p.promise.id)}"${p.promise.id === selected ? " selected" : ""}>${escapeHtml(shortId(p.promise.id))} · ${escapeHtml(p.state)} · ${escapeHtml(p.promise.merchantId)}</option>`).join("") || `<option value="">— no promises yet —</option>`}</select></div></form>
      </div>
      ${t === null ? emptyState("⧗", "No promise selected", "Create a promise in the Purchase Copilot first.") : `
      <div class="card section-gap"><h2>Schedule ${t.rescheduled ? '<span class="pill warn">RESCHEDULED BY INCIDENT</span>' : '<span class="pill ok">ON BASELINE</span>'}</h2>
        ${timelineSvg(t)}
        <p class="small muted">Generated ${formatTime(t.generatedAt)} · state ${escapeHtml(t.state)}. Hover a bar for dates, dependencies, and shift reasons.</p>
      </div>
      <div class="card section-gap"><h2>Tasks (${t.tasks.length})</h2>
        <div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Task</th><th scope="col">Kind</th><th scope="col">Window</th><th scope="col">Status</th><th scope="col">Depends on</th><th scope="col">Note</th></tr></thead><tbody>
        ${t.tasks.map((task) => `<tr><td>${escapeHtml(task.label)}${task.shiftedByIncident ? ` <span class="pill warn">+${task.shiftedByIncident.daysShifted}d</span>` : ""}</td><td>${escapeHtml(task.kind)}</td><td class="mono">${escapeHtml(task.start.slice(0, 10))} → ${escapeHtml(task.end.slice(0, 10))}</td><td>${escapeHtml(task.status)}</td><td class="mono">${escapeHtml((task.dependsOn ?? []).join(", ") || "—")}</td><td class="small">${escapeHtml(task.note)}</td></tr>`).join("")}</tbody></table></div>
      </div>
      ${(t.notes ?? []).length > 0 ? `<div class="card section-gap"><h2>Notes</h2><ul>${t.notes.map((n) => `<li class="small">${escapeHtml(n)}</li>`).join("")}</ul></div>` : ""}`}`;
    $("#tlPromise")?.addEventListener("change", (ev) => { void renderTimeline(ev.target.value); });
  } catch (err) {
    view().innerHTML = viewHead("Recovery Timeline", "") + errorBanner(err.message);
  }
}

/* ================================================================
   VIEW: Outcome Twin (promised vs actual vs recovered)
   ================================================================ */
async function renderTwin(promiseId = "") {
  setNav("twin");
  if (!promiseId) {
    view().innerHTML = viewHead("Outcome Twin", "Promised vs actual vs recovered — one purchase, three synchronized realities.") + loadingState();
    try {
      const promises = await api("/api/promises");
      if (promises.length === 0) {
        view().innerHTML = viewHead("Outcome Twin", "") + `<div class="card">${emptyState("⧉", "No purchases yet", "Create a purchase in the Copilot first.", "")}</div>`;
        return;
      }
      view().innerHTML = viewHead("Outcome Twin", "") + `
        <div class="card"><h2>Select a purchase</h2>
        <div class="table-wrap"><table><thead><tr><th>Promise</th><th>Merchant</th><th class="num">Total</th><th>State</th><th></th></tr></thead>
        <tbody>${promises.map((t) => `
          <tr><td class="mono">${escapeHtml(shortId(t.promise.id))}</td><td>${escapeHtml(t.promise.merchantId)}</td>
          <td class="num"><strong>${formatMoney(t.promise.total)}</strong></td><td>${statePill(t.state)}</td>
          <td><a class="button small" href="#/twin?promiseId=${encodeURIComponent(t.promise.id)}">Open twin</a></td></tr>`).join("")}
        </tbody></table></div></div>`;
    } catch (err) {
      view().innerHTML = viewHead("Outcome Twin", "") + errorBanner(err.message);
    }
    return;
  }
  view().innerHTML = viewHead("Outcome Twin", `Promise ${promiseId}`) + loadingState();
  try {
    const v = await api(`/api/promises/${encodeURIComponent(promiseId)}`);
    const [orders, outcomes, incidentsAll, proposalsAll, audit] = await Promise.all([
      Promise.all((v.orderIds ?? []).map((id) => api(`/api/payments/orders/${encodeURIComponent(id)}`).catch((e) => ({ error: e.message })))),
      api(`/api/outcomes?promiseId=${encodeURIComponent(promiseId)}`).catch(() => []),
      api("/api/incidents").catch(() => []),
      api("/api/resolutions").catch(() => []),
      api(`/api/audit?promiseId=${encodeURIComponent(promiseId)}&limit=200`).catch(() => ({ entries: [], chainValid: true })),
    ]);
    const p = v.promise;
    const incidents = incidentsAll.filter((i) => i.promiseId === promiseId);
    const proposals = proposalsAll.filter((x) => x.promiseId === promiseId);
    const entries = audit.entries ?? [];
    const refunds = entries.filter((e) => e.type === "refund.verified");
    const refundedMinor = refunds.reduce((n, e) => n + (e.payload?.amount?.currency === p.total.currency ? (e.payload.amount.amountMinor ?? 0) : 0), 0);
    const openIncidents = incidents.filter((i) => i.status === "open" || i.status === "triaged" || i.status === "resolving");
    const exposureMinor = openIncidents.length > 0 ? Math.max(0, p.total.amountMinor - refundedMinor) : 0;
    const decidedIds = new Set(entries.filter((e) => e.type === "resolution.approved" || e.type === "resolution.rejected").map((e) => e.payload?.proposalId));
    const pendingProposals = proposals.filter((x) => !decidedIds.has(x.id));
    const focus = openIncidents[openIncidents.length - 1] ?? incidents[incidents.length - 1] ?? null;

    const promisedCol = `
      <div class="card"><h3>What was promised</h3>
      <dl class="kv">
        <dt>Total</dt><dd><strong>${formatMoney(p.total)}</strong></dd>
        <dt>Merchant</dt><dd>${escapeHtml(p.merchantId)}</dd>
        <dt>Items</dt><dd>${p.items.map((i) => `${escapeHtml(i.name)} × ${i.quantity}`).join("<br>")}</dd>
        <dt>Delivery</dt><dd>${formatTime(p.expectedDeliveryDate)} <span class="muted small">(±${p.tolerances.maxDelayDays}d)</span></dd>
        <dt>Approval</dt><dd>${p.approval ? `${escapeHtml(p.approval.approvedBy)} · ${formatTime(p.approval.approvedAt)}` : "—"}</dd>
        <dt>Resolution rules</dt><dd class="small">auto-refund ${p.resolutionPolicy.autoRefundOnMiss ? "on" : "off"} · buyer approval ${p.resolutionPolicy.requireBuyerApproval ? "required" : "not required"}</dd>
        <dt>Integrity</dt><dd class="mono small">v${p.version} · ${escapeHtml(p.hash.slice(0, 16))}…</dd>
      </dl></div>`;

    const ordersHtml = orders.length === 0 ? `<p class="muted small">No payment yet.</p>` : orders.map((o) => o.error
      ? `<p class="small muted">Order lookup failed.</p>`
      : `<p class="small"><span class="mono">${escapeHtml(shortId(o.order.providerOrderId ?? o.order.id))}</span> · ${escapeHtml(o.order.status)} · ${formatMoney(o.order.amount)} ${originPill(o.transport)}</p>`).join("");
    const actualCol = `
      <div class="card"><h3>What actually happened</h3>
      <h3>Payment</h3>${ordersHtml}
      <h3 class="section-gap">Outcomes (${outcomes.length})</h3>
      ${outcomes.length === 0 ? `<p class="muted small">No outcomes recorded.</p>` : `<ul class="timeline">${outcomes.map((o) => `
        <li><span class="dot" aria-hidden="true"></span><span class="event-type">${escapeHtml(o.kind)}</span>
        <div class="small">${escapeHtml(o.summary)}</div>
        <div class="event-meta">${escapeHtml(o.provenance.source)} · conf ${o.confidence}</div></li>`).join("")}</ul>`}
      <h3 class="section-gap">Incidents (${incidents.length})</h3>
      ${incidents.length === 0 ? `<p class="muted small">No gaps detected.</p>` : incidents.map((i) => `
        <p class="small"><span class="pill ${i.severity === "critical" || i.severity === "high" ? "bad" : "warn"}">${escapeHtml(i.category)}</span>
        <span class="pill info">${escapeHtml(i.status.toUpperCase())}</span><br>${escapeHtml(i.detail)}</p>`).join("")}
      <p class="small">Outstanding exposure: <strong>${formatMoney({ currency: p.total.currency, amountMinor: exposureMinor })}</strong></p></div>`;

    const proposalHtml = proposals.length === 0 ? `<p class="muted small">No proposals yet.</p>` : proposals.map((x) => {
      const decision = entries.find((e) => (e.type === "resolution.approved" || e.type === "resolution.rejected") && e.payload?.proposalId === x.id);
      const verified = entries.find((e) => e.type === "refund.verified" && e.payload?.proposalId === x.id);
      const status = verified ? `<span class="pill ok">VERIFIED REFUND</span>` : decision ? `<span class="pill ${decision.type === "resolution.approved" ? "ok" : "bad"}">${escapeHtml(decision.type === "resolution.approved" ? "APPROVED" : "REJECTED")} · ${escapeHtml(decision.actor ?? "?")}</span>` : `<span class="pill warn">AWAITING APPROVAL</span>`;
      return `<p class="small"><strong>${escapeHtml(x.kind)}</strong> · ${x.amount ? formatMoney(x.amount) : "—"}<br>${status}
        ${verified ? `<br><span class="mono">provider ${escapeHtml(verified.payload.providerRefundId ?? verified.payload.refundId)} · ${escapeHtml(verified.payload.status)}</span> ${originPill(verified.payload.transport)}` : ""}</p>`;
    }).join("");
    const recoveredCol = `
      <div class="card"><h3>What AFTERPACT recovered</h3>
      ${focus ? `
      <div class="button-row">
        <button class="button small secondary" id="twinAnalyze">Analyze with AI</button>
        <button class="button small secondary" id="twinPropose">AI recovery proposal</button>
      </div>
      <div id="twinAiBox" role="status" class="section-gap"></div>` : `<p class="muted small">No incident to analyze.</p>`}
      <h3 class="section-gap">Resolutions (${proposals.length})</h3>${proposalHtml}
      <p class="small">Verified refunded: <strong>${formatMoney({ currency: p.total.currency, amountMinor: refundedMinor })}</strong></p>
      <p class="small">${audit.chainValid ? '<span class="pill ok">CHAIN VALID</span>' : '<span class="pill bad">CHAIN BROKEN</span>'}</p></div>`;

    // Divergence strip: one glanceable row linking the violated obligation to
    // its evidence and the proposed financial correction. Rendered only from
    // the live data above — never projected or animated ahead of provider truth.
    const correction = pendingProposals[0] ?? proposals[proposals.length - 1] ?? null;
    const divergenceStrip = focus ? `
      <div class="card twin-divergence" role="note" aria-label="Incident divergence summary">
        <span class="pill bad">DIVERGENCE</span>
        <strong>${escapeHtml(focus.category)}</strong>
        <span class="small">${escapeHtml(shortDetail(focus.detail))}</span>
        <span class="small muted">Evidence: ${outcomes.length} outcome${outcomes.length === 1 ? "" : "s"} · Proposed correction: ${correction ? `${escapeHtml(correction.kind)}${correction.amount ? ` · ${formatMoney(correction.amount)}` : ""}` : "none yet"}</span>
        <span class="small"><a href="#/recovery">Review in Recovery Center →</a></span>
      </div>` : ``;

    view().innerHTML = viewHead("Outcome Twin", `Promise ${p.id}`) + `
      <div class="badge-row" style="margin-bottom:1rem">${statePill(v.state)}
        <span class="pill ${v.policy.verdict === "Cleared" ? "ok" : v.policy.verdict === "Hold" ? "warn" : "bad"}">POLICY · ${escapeHtml(v.policy.verdict.toUpperCase())}</span>
        <span class="small"><a href="#/tx/${encodeURIComponent(promiseId)}">Transaction →</a> · <a href="#/recovery">Recovery Center →</a> · <a href="#/twin">All twins →</a></span></div>
      ${divergenceStrip}
      <div class="grid three">${promisedCol}${actualCol}${recoveredCol}</div>
      <div class="card section-gap"><h3>If left unresolved — projection from current state, not measured history</h3>
        <p class="small">Open incidents: <strong>${openIncidents.length}</strong> · Unresolved exposure: <strong>${formatMoney({ currency: p.total.currency, amountMinor: exposureMinor })}</strong> · Proposals awaiting approval: <strong>${pendingProposals.length}</strong></p>
        <p class="small muted">Assumes no further outcomes or approvals; recomputed live from the data above.</p></div>`;

    if (focus) {
      $("#twinAnalyze")?.addEventListener("click", async () => {
        const box = $("#twinAiBox");
        box.innerHTML = loadingState("Asking the model…");
        try {
          const r = await api("/api/ai/analyze-incident", { method: "POST", body: { promiseId, observation: { note: focus.detail.slice(0, 2000) } } });
          box.innerHTML = aiAnalysisHtml(r);
        } catch (err) {
          box.innerHTML = aiErrorHtml(err);
        }
      });
      $("#twinPropose")?.addEventListener("click", async () => {
        const box = $("#twinAiBox");
        box.innerHTML = loadingState("Asking the model…");
        try {
          const r = await api("/api/ai/plan-recovery", { method: "POST", body: { incidentId: focus.id } });
          box.innerHTML = recoveryProposalHtml(r, p.total.currency);
        } catch (err) {
          box.innerHTML = aiErrorHtml(err);
        }
      });
    }
  } catch (err) {
    view().innerHTML = viewHead("Outcome Twin", "") + errorBanner(err.message);
  }
}

/* ================================================================
   Router + init
   ================================================================ */
function currentRoute() {
  const hash = window.location.hash || "#/";
  const [path, query] = hash.slice(1).split("?");
  return { path: path || "/", params: new URLSearchParams(query ?? "") };
}

/* ---------- VIEW: AI Evidence Gallery (recorded, never live) ---------- */
const aiGallery = { task: "all" };

function formatCostUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(6)}`;
}

function gallerySampleHtml(sample) {
  if (!sample || typeof sample !== "object") return "";
  const parts = [];
  if (typeof sample.interpretation === "string" && sample.interpretation) {
    parts.push(`<p class="sample-text">“${escapeHtml(sample.interpretation)}”</p>`);
  }
  if (typeof sample.rationale === "string" && sample.rationale) {
    parts.push(`<p class="sample-text">“${escapeHtml(sample.rationale)}”</p>`);
  }
  for (const key of ["requirements", "ambiguities"]) {
    const list = sample[key];
    if (Array.isArray(list) && list.length > 0) {
      parts.push(`<h3>${key === "requirements" ? "Requirements stated" : "Ambiguities flagged"}</h3><ul>${list.map((x) => `<li class="small">${escapeHtml(String(x))}</li>`).join("")}</ul>`);
    }
  }
  const c = sample.constraints;
  if (c && typeof c === "object") {
    const rows = Object.entries(c).map(([k, v]) => `<li class="small"><span class="mono">${escapeHtml(k)}</span>: <span class="mono">${escapeHtml(v === null ? "null" : String(v))}</span></li>`).join("");
    parts.push(`<h3>Structured constraints (model output)</h3><ul>${rows}</ul>`);
  }
  return parts.join("");
}

function galleryCardHtml(f) {
  const taskCls = f.task === "intent" ? "info" : f.task === "incident" ? "warn" : "accent";
  const meta = [];
  meta.push(`model <span class="mono">${escapeHtml(f.modelServed)}</span>`);
  meta.push(`${escapeHtml(String(f.latencyMs))} ms`);
  meta.push(`${escapeHtml(String(f.promptTokens))}+${escapeHtml(String(f.completionTokens))} tokens`);
  meta.push(formatCostUsd(f.costUsd));
  meta.push(`citations ${escapeHtml(String(f.citationsKept))} kept / ${escapeHtml(String(f.citationsDropped))} dropped`);
  if (f.category) meta.push(`category <span class="mono">${escapeHtml(f.category)}</span>`);
  if (f.strategy) meta.push(`strategy <span class="mono">${escapeHtml(f.strategy)}</span>`);
  if (f.gateVerdict) meta.push(`gate <span class="mono">${escapeHtml(f.gateVerdict)}</span>`);
  if (f.fallbackUsed) meta.push(`fallback used`);
  const checks = (f.checks ?? []).map((c) => `<li class="small"><span class="pill ${c.pass ? "ok" : "bad"}">${c.pass ? "OK" : "FAIL"}</span> <span class="mono">${escapeHtml(c.check)}</span></li>`).join("");
  return `<div class="card section-gap"><h2><span class="mono">${escapeHtml(f.id)}</span></h2>
    <div class="badge-row"><span class="pill ${taskCls}">${escapeHtml(String(f.task).toUpperCase())}</span>${originPill("recorded-ai")}<span class="pill ${f.pass ? "ok" : "bad"}">${f.pass ? "PASS" : "FAIL"}</span></div>
    <p class="small muted">${meta.join(" · ")}</p>
    ${gallerySampleHtml(f.sample)}
    <details><summary class="small">Validation checks: ${escapeHtml(String(f.checksPassed))}/${escapeHtml(String(f.checksTotal))}</summary><ul>${checks}</ul></details>
    <p class="small muted">Source: <span class="mono">${escapeHtml(f.sourceReport)}</span></p></div>`;
}

async function renderAiGallery() {
  setNav("ai-gallery");
  const head = viewHead("AI Evidence Gallery", "Authentic model outputs recorded during keyed evaluation runs — shown here as evidence, never re-executed. The public demo ships without an inference key.");
  view().innerHTML = head + loadingState();
  try {
    const res = await fetch("gallery/ai-gallery.json");
    if (!res.ok) throw new Error(`Gallery data unavailable (HTTP ${res.status})`);
    const g = await res.json();
    const tasks = ["all", "intent", "incident", "recovery"];
    const list = g.featured.filter((f) => aiGallery.task === "all" || f.task === aiGallery.task);
    const kpis = `<div class="grid kpi section-gap">
      <div class="card"><div class="kpi-value">${escapeHtml(String(g.totals.passed))}/${escapeHtml(String(g.totals.scenarios))}</div><div class="kpi-label">Scenarios passed (3 runs)</div><div class="kpi-sub">Failures kept in the record, not hidden</div></div>
      <div class="card"><div class="kpi-value">${escapeHtml(String(Math.min(...g.runs.map((r) => r.citationPrecision)).toFixed(3)))}</div><div class="kpi-label">Min citation precision</div><div class="kpi-sub">${escapeHtml(String(g.runs.reduce((n, r) => n + r.citationsKept, 0)))} kept, ${escapeHtml(String(g.runs.reduce((n, r) => n + r.citationsDropped, 0)))} dropped</div></div>
      <div class="card"><div class="kpi-value">${formatCostUsd(g.totals.costUsd)}</div><div class="kpi-label">Total recorded inference cost</div><div class="kpi-sub">${escapeHtml(g.provider)} · <span class="mono">${escapeHtml(g.model)}</span></div></div>
    </div>`;
    const runs = `<div class="card section-gap"><h2>Recorded runs</h2><div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Recorded</th><th scope="col">Passed</th><th scope="col">Citation prec.</th><th scope="col">Latency p50/p95</th><th scope="col">Cost</th><th scope="col">Report</th></tr></thead><tbody>
      ${g.runs.map((r) => `<tr><td>${formatTime(r.recordedAt)}</td><td class="num">${escapeHtml(String(r.passed))}/${escapeHtml(String(r.scenarios))}</td><td class="num">${escapeHtml(String(Number(r.citationPrecision).toFixed(3)))}</td><td class="num">${escapeHtml(String(r.latencyP50Ms))}/${escapeHtml(String(r.latencyP95Ms))} ms</td><td class="num">${formatCostUsd(r.costUsd)}</td><td><span class="mono">${escapeHtml(r.report)}</span></td></tr>`).join("")}</tbody></table></div>
      <p class="small muted">${escapeHtml(g.notice)}</p></div>`;
    const featured = `<div class="card section-gap"><h2>Featured runs</h2>
      <div class="field"><label for="galleryTask">Task</label><select id="galleryTask">${tasks.map((t) => `<option value="${t}"${t === aiGallery.task ? " selected" : ""}>${t === "all" ? "All tasks" : t}</option>`).join("")}</select></div></div>
      ${list.map(galleryCardHtml).join("") || emptyState("❖", "No featured runs", "No recorded outcome matches this task filter.")}`;
    const repro = `<div class="card section-gap"><h2>Reproduce with your own key</h2>
      <p class="small">Requires: <span class="mono">${escapeHtml(g.reproduce.requires)}</span></p>
      <pre class="mono">${escapeHtml(g.reproduce.steps.join("\n"))}</pre>
      <p class="small muted">${escapeHtml(g.reproduce.note)}</p></div>`;
    view().innerHTML = head + `<div class="badge-row section-gap">${originPill("recorded-ai")}<span class="pill">NO INFERENCE ON THIS PAGE</span></div>` + kpis + runs + featured + repro;
    $("#galleryTask")?.addEventListener("change", (ev) => {
      aiGallery.task = ev.target.value;
      void renderAiGallery();
    });
  } catch (err) {
    view().innerHTML = head + errorBanner(err.message);
  }
}

async function route() {
  const { path, params } = currentRoute();
  $("#sidenav").classList.remove("open");
  $("#navToggle").setAttribute("aria-expanded", "false");
  if (path === "/") return renderCommand();
  if (path === "/copilot") return renderCopilot();
  if (path === "/tx") return renderTxList();
  if (path.startsWith("/tx/")) return renderTxDetail(decodeURIComponent(path.slice(4)));
  if (path === "/twin") return renderTwin(params.get("promiseId") ?? "");
  if (path === "/recovery") return renderRecovery();
  if (path === "/studio") return renderStudio();
  if (path === "/discovery") return renderDiscovery();
  if (path === "/timeline") return renderTimeline(params.get("promiseId") ?? "");
  if (path === "/recorder") return renderRecorder(params.get("promiseId") ?? "");
  if (path === "/developer") return renderDeveloper();
  if (path === "/demo") return renderDemo();
  if (path === "/judge") return renderJudge();
  if (path === "/ai-gallery") return renderAiGallery();
  setNav("");
  view().innerHTML = viewHead("Not found", "") + `<div class="card">${emptyState("◈", "Unknown view", "That route does not exist.", '<p><a class="button small" href="#/">Back to Command Center</a></p>')}</div>`;
}

function init() {
  initTheme();
  $("#navToggle").addEventListener("click", () => {
    const nav = $("#sidenav");
    const open = nav.classList.toggle("open");
    $("#navToggle").setAttribute("aria-expanded", String(open));
  });
  window.addEventListener("hashchange", () => { void route(); void refreshTopbar(); });
  void refreshTopbar();
  void route();
  window.setInterval(() => { void refreshTopbar(); }, 15000);
}

document.addEventListener("DOMContentLoaded", init);

