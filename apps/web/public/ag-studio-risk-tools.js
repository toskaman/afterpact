/* AFTERPACT x AG Studio: Outcome Risk Analyst custom tools.
 *
 * Plain script (no modules): loaded lazily by the /studio view after the
 * vendored ag-studio UMD bundle and the Vultr adapter. Defines three
 * READ-ONLY client tools via the documented `api.defineAiTool` API
 * (AG Studio 3.1.0, Custom Tools), listed on the custom
 * "outcome-risk-analyst" agent built with `directLlmRunner`.
 *
 * Security bounds (asserted by tests/unit/studio-risk-tools.test.ts):
 * - Every tool performs GET requests only, to the single allowlisted
 *   endpoint /api/studio/datasets. No POST, no payment/refund/approval/
 *   reset endpoint is reachable from this file.
 * - Record contents are treated as untrusted data: only known fields are
 *   read, numbers are coerced with safe fallbacks, output rows are capped.
 * - The Studio abort signal is forwarded to every fetch.
 * - Arguments that fail Studio schema validation never reach `execute`;
 *   `execute` still clamps bounds defensively (row caps, status allowlist).
 */
(function () {
  "use strict";

  var DATASETS_URL = "/api/studio/datasets";
  var MAX_ROWS = 50;
  var MAX_TEXT_CHARS = 4000;
  var REFUND_STATUSES = ["requested", "submitted", "succeeded", "failed"];
  var TOOL_NAMES = [
    "get_incident_exposure",
    "get_promise_outcome_comparison",
    "get_refund_verification_status",
  ];

  var RISK_ANALYST_INSTRUCTIONS = [
    "You are the AFTERPACT Outcome Risk Analyst, a merchant-operations assistant.",
    "Answer from tool results only: call a get_* tool before stating any incident, exposure, or refund fact.",
    "All money is in minor units with an explicit currency; never invent amounts, merchants, or resolutions.",
    "Distinguish what the data proves (captured, refunded, verified) from what needs a human (open incidents, pending verification).",
    "Never claim you executed a payment, capture, refund, or approval: your tools are read-only and AFTERPACT requires human authorization for consequential actions.",
    "When asked for a chart, use the Studio dashboard tools (view schema, query, add widget) over the same sources; cite the source rows you used.",
  ].join(" ");

  var RISK_STARTER = {
    label: "Outcome risk briefing",
    prompt: "Brief me on outcome risk: list unresolved incidents by unrefunded exposure, compare promised versus observed outcomes, and flag refunds still awaiting verification.",
  };

  function asNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  function asString(value, fallback) {
    return typeof value === "string" ? value : fallback;
  }

  function money(minor, currency) {
    var units = (asNumber(minor, 0) / 100).toFixed(2);
    return units + " " + asString(currency, "USD") + " (" + asNumber(minor, 0) + " minor)";
  }

  function truncate(text) {
    var str = String(text);
    return str.length > MAX_TEXT_CHARS ? str.slice(0, MAX_TEXT_CHARS) + "… [truncated]" : str;
  }

  async function fetchDatasets(fetcher, signal) {
    var res = await fetcher(DATASETS_URL, { signal: signal });
    if (!res || res.ok !== true) {
      throw new Error("studio datasets unavailable (HTTP " + (res && res.status) + ")");
    }
    var json = await res.json();
    if (!json || typeof json.data !== "object" || json.data === null) {
      throw new Error("studio datasets response has no data envelope");
    }
    return json.data;
  }

  function clampTopN(raw) {
    var n = asNumber(raw, 10);
    if (!Number.isInteger(n)) n = 10;
    return Math.min(MAX_ROWS, Math.max(1, n));
  }

  /** Incidents ranked by unrefunded exposure (minor units), open first. */
  function summarizeExposure(datasets, topN) {
    var incidents = Array.isArray(datasets.incidents) ? datasets.incidents : [];
    var open = new Set(["open", "triaged", "resolving"]);
    var ranked = incidents
      .map(function (i) {
        return {
          id: asString(i.id, "?"),
          category: asString(i.category, "?"),
          severity: asString(i.severity, "?"),
          status: asString(i.status, "?"),
          unrefundedMinor: asNumber(i.promiseUnrefundedMinor, 0),
          currency: asString(i.currency, "USD"),
          ageHours: asNumber(i.ageHours, 0),
          proposalCount: asNumber(i.proposalCount, 0),
          decided: i.decided === true,
        };
      })
      .sort(function (a, b) {
        var ao = open.has(a.status) ? 0 : 1;
        var bo = open.has(b.status) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return b.unrefundedMinor - a.unrefundedMinor;
      });
    var limit = clampTopN(topN);
    var rows = ranked.slice(0, limit);
    var totalOpen = ranked.filter(function (r) { return open.has(r.status); }).length;
    var lines = rows.map(function (r, index) {
      return (index + 1) + ". " + r.id.slice(0, 8) + " " + r.category + "/" + r.severity + " [" + r.status + "] unrefunded " +
        money(r.unrefundedMinor, r.currency) + ", age " + r.ageHours + "h, proposals " + r.proposalCount +
        (r.decided ? " (decided)" : " (awaiting decision)");
    });
    var text = "Incident exposure from live Studio datasets (" + ranked.length + " incident(s), " +
      totalOpen + " open). Top " + rows.length + " by unrefunded balance:\n" + (lines.join("\n") || "none") +
      "\nScope: /api/studio/datasets at call time; amounts are captured-minus-refunded per linked promise.";
    return { text: truncate(text), rows: rows, scope: { incidents: ranked.length, open: totalOpen, shown: rows.length } };
  }

  /** Promised-vs-observed comparison per promise, with evidence coverage. */
  function summarizePromiseOutcomes(datasets, onlyOpen) {
    var promises = Array.isArray(datasets.promises) ? datasets.promises : [];
    var filtered = onlyOpen === true ? promises.filter(function (p) { return asNumber(p.openIncidentCount, 0) > 0; }) : promises;
    var rows = filtered.slice(0, MAX_ROWS).map(function (p) {
      return {
        id: asString(p.id, "?"),
        merchantId: asString(p.merchantId, "?"),
        state: asString(p.state, "?"),
        total: money(p.totalMinor, p.currency),
        approved: p.approved === true,
        incidents: asNumber(p.incidentCount, 0),
        openIncidents: asNumber(p.openIncidentCount, 0),
        outcomes: asNumber(p.outcomeCount, 0),
        evidence: String(asNumber(p.evidenceCount, 0)) + "/" + String(asNumber(p.evidenceRequired, 0)),
      };
    });
    var lines = rows.map(function (r, index) {
      return (index + 1) + ". " + r.id.slice(0, 8) + " " + r.merchantId + " " + r.state + " promised " + r.total +
        (r.approved ? " approved" : " UNAPPROVED") + ", incidents " + r.openIncidents + "/" + r.incidents +
        " open, outcomes " + r.outcomes + ", evidence " + r.evidence;
    });
    var text = "Promise/outcome comparison from live Studio datasets (" + filtered.length + " promise(s)" +
      (onlyOpen === true ? ", only with open incidents" : "") + "). Showing " + rows.length + ":\n" +
      (lines.join("\n") || "none") +
      "\nScope: /api/studio/datasets at call time; evidence is collected/required per promise.";
    return { text: truncate(text), rows: rows, scope: { promises: filtered.length, shown: rows.length } };
  }

  /** Refund verification status grouped by status, with remaining capture balances. */
  function summarizeRefundStatus(datasets, status) {
    var refunds = Array.isArray(datasets.refunds) ? datasets.refunds : [];
    var captures = Array.isArray(datasets.captures) ? datasets.captures : [];
    var wanted = typeof status === "string" && status !== "" ? status.toLowerCase() : null;
    if (wanted !== null && REFUND_STATUSES.indexOf(wanted) === -1) {
      return { error: "Unknown refund status '" + status + "'. Use one of: " + REFUND_STATUSES.join(", ") + "." };
    }
    var filtered = wanted === null ? refunds : refunds.filter(function (r) { return asString(r.status, "") === wanted; });
    var remainingByCapture = {};
    captures.forEach(function (c) {
      remainingByCapture[asString(c.id, "")] = asNumber(c.remainingMinor, 0);
    });
    var rows = filtered.slice(0, MAX_ROWS).map(function (r) {
      return {
        id: asString(r.id, "?"),
        status: asString(r.status, "?"),
        amount: money(r.amountMinor, r.currency),
        captureId: asString(r.captureId, "?").slice(0, 8),
        captureRemainingMinor: remainingByCapture[asString(r.captureId, "")] ?? null,
        reason: asString(r.reason, ""),
      };
    });
    var byStatus = {};
    refunds.forEach(function (r) {
      var s = asString(r.status, "?");
      byStatus[s] = (byStatus[s] || 0) + 1;
    });
    var lines = rows.map(function (r, index) {
      return (index + 1) + ". " + r.id.slice(0, 8) + " [" + r.status + "] " + r.amount +
        " capture " + r.captureId + " remaining " + (r.captureRemainingMinor === null ? "n/a" : r.captureRemainingMinor + " minor");
    });
    var text = "Refund verification from live Studio datasets (" + refunds.length + " refund(s): " +
      Object.keys(byStatus).map(function (k) { return k + "=" + byStatus[k]; }).join(", ") + "). " +
      (wanted === null ? "Showing " + rows.length + ":" : "Status '" + wanted + "', showing " + rows.length + ":") + "\n" +
      (lines.join("\n") || "none") +
      "\nScope: /api/studio/datasets at call time; only provider-confirmed states count as verified.";
    return { text: truncate(text), rows: rows, scope: { refunds: refunds.length, shown: rows.length, byStatus: byStatus } };
  }

  function defineRiskTools(studioApi, fetcher) {
    var fetchImpl = fetcher || fetch;
    return [
      studioApi.defineAiTool({
        name: "get_incident_exposure",
        description: "List incidents ranked by unrefunded financial exposure from live AFTERPACT Studio datasets. Read-only.",
        params: function (s) {
          return s.object({
            top_n: s.number({ description: "How many top rows to return (1-50, default 10)." }).optional(),
          });
        },
        execute: async function (args, ctx) {
          try {
            var datasets = await fetchDatasets(fetchImpl, ctx.signal);
            var summary = summarizeExposure(datasets, args ? args.top_n : undefined);
            return ctx.success(summary.text, { exposure: summary.rows, scope: summary.scope });
          } catch (err) {
            return ctx.error("Incident exposure lookup failed: " + (err && err.message ? err.message : String(err)));
          }
        },
      }),
      studioApi.defineAiTool({
        name: "get_promise_outcome_comparison",
        description: "Compare promised versus observed outcomes per purchase promise (state, approval, incidents, outcomes, evidence coverage). Read-only.",
        params: function (s) {
          return s.object({
            only_open: s.boolean({ description: "Only promises with open incidents (default false)." }).optional(),
          });
        },
        execute: async function (args, ctx) {
          try {
            var datasets = await fetchDatasets(fetchImpl, ctx.signal);
            var summary = summarizePromiseOutcomes(datasets, !!(args && args.only_open));
            return ctx.success(summary.text, { promises: summary.rows, scope: summary.scope });
          } catch (err) {
            return ctx.error("Promise/outcome lookup failed: " + (err && err.message ? err.message : String(err)));
          }
        },
      }),
      studioApi.defineAiTool({
        name: "get_refund_verification_status",
        description: "Show refund verification status grouped by status with remaining capture balances. Read-only.",
        params: function (s) {
          return s.object({
            status: s.string({ description: "Filter by refund status: requested, submitted, succeeded, failed. Omit for all." }).optional(),
          });
        },
        execute: async function (args, ctx) {
          try {
            var datasets = await fetchDatasets(fetchImpl, ctx.signal);
            var summary = summarizeRefundStatus(datasets, args ? args.status : undefined);
            if (summary.error) return ctx.error(summary.error);
            return ctx.success(summary.text, { refunds: summary.rows, scope: summary.scope });
          } catch (err) {
            return ctx.error("Refund status lookup failed: " + (err && err.message ? err.message : String(err)));
          }
        },
      }),
    ];
  }

  var api = {
    DATASETS_URL: DATASETS_URL,
    MAX_ROWS: MAX_ROWS,
    TOOL_NAMES: TOOL_NAMES,
    REFUND_STATUSES: REFUND_STATUSES,
    RISK_ANALYST_INSTRUCTIONS: RISK_ANALYST_INSTRUCTIONS,
    RISK_STARTER: RISK_STARTER,
    defineRiskTools: defineRiskTools,
    summarizeExposure: summarizeExposure,
    summarizePromiseOutcomes: summarizePromiseOutcomes,
    summarizeRefundStatus: summarizeRefundStatus,
  };

  if (typeof window !== "undefined") {
    window.AfterpactStudioRiskTools = api;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
