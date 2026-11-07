/**
 * Deterministic heuristic intent extraction. This is NOT an LLM: it applies
 * documented regex/keyword rules to fill structured intent fields from raw
 * text. Every response labels itself `heuristic-parse` so the UI can mark it
 * honestly. Model-backed extraction is a future plan (see docs).
 */

export interface ParsedIntent {
  quantity: number;
  budgetMinor: number | null;
  currency: string;
  categories: string[];
  deadlineDays: number;
  allowMerchants: string[];
  denyMerchants: string[];
  mandatory: string[];
  notes: string[];
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/sensor|iot|telemetry/i, "sensors"],
  [/laptop|computer|workstation|server/i, "compute"],
  [/cable|adapter|connector|mount/i, "accessories"],
  [/toolkit|equipment|instrument/i, "equipment"],
  [/office|desk|chair|furniture/i, "office"],
  [/network|router|switch|wifi/i, "networking"],
  [/camera|surveillance/i, "cameras"],
  [/solar|battery|power/i, "power"],
];

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"];

export function parseIntentText(rawText: string, nowMs: number): ParsedIntent {
  const notes: string[] = [];
  const text = rawText.slice(0, 4000);

  // Quantity: digits ("3 kits", "3x") or words ("three kits").
  let quantity = 1;
  const digitQty = text.match(/(\d{1,3})\s*(?:x|×|units?|items?|kits?|packs?|pieces?|sensors?|laptops?)\b/i);
  if (digitQty?.[1] !== undefined) {
    quantity = Math.min(999, Math.max(1, Number.parseInt(digitQty[1], 10)));
    notes.push(`quantity ${quantity} from "${digitQty[0].trim()}"`);
  } else {
    const wordQty = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b\s+(?:x\s+)?[a-z-]*\s*(?:units?|items?|kits?|packs?|pieces?|sensors?|laptops?|sets?)/i);
    const word = wordQty?.[1]?.toLowerCase();
    if (word !== undefined && WORD_NUMBERS[word] !== undefined) {
      quantity = WORD_NUMBERS[word] as number;
      notes.push(`quantity ${quantity} from word "${wordQty?.[0].trim()}"`);
    } else {
      notes.push("quantity defaulted to 1 (no match)");
    }
  }

  // Budget: $1,234.56 / USD 1200 / budget of 500 dollars.
  let budgetMinor: number | null = null;
  let currency = "USD";
  const moneyMatch = text.match(/(?:US\$|USD|\$|EUR|€|GBP|£)\s?([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s?(USD|EUR|GBP|JPY|CAD|AUD|CHF|dollars?|euros?)/i);
  if (moneyMatch !== null) {
    const amountRaw = (moneyMatch[1] ?? moneyMatch[2] ?? "").replace(/,/g, "");
    const major = Number.parseFloat(amountRaw);
    if (Number.isFinite(major) && major > 0 && major < 100_000_000) {
      const symbol = (moneyMatch[0].match(/EUR|€|euros?/i) && "EUR") ||
        (moneyMatch[0].match(/GBP|£/i) && "GBP") ||
        (moneyMatch[3]?.toUpperCase().replace(/DOLLARS?/, "USD").replace(/EUROS?/, "EUR") ?? "USD");
      currency = CURRENCIES.includes(symbol) ? symbol : "USD";
      const decimals = currency === "JPY" ? 0 : 2;
      budgetMinor = Math.round(major * 10 ** decimals);
      notes.push(`budget ${budgetMinor} minor (${currency}) from "${moneyMatch[0].trim()}"`);
    }
  }
  if (budgetMinor === null) notes.push("no budget detected (caller must supply one)");

  // Deadline: "within N days", "in N weeks", "by 2026-12-01".
  let deadlineDays = 30;
  const withinDays = text.match(/within\s+(\d{1,3})\s+days?/i);
  const inWeeks = text.match(/in\s+(\d{1,2})\s+weeks?/i);
  const byDate = text.match(/by\s+(\d{4}-\d{2}-\d{2})/);
  if (withinDays?.[1] !== undefined) {
    deadlineDays = Math.min(365, Math.max(1, Number.parseInt(withinDays[1], 10)));
    notes.push(`deadline in ${deadlineDays} days from "${withinDays[0]}"`);
  } else if (inWeeks?.[1] !== undefined) {
    deadlineDays = Math.min(365, Math.max(1, Number.parseInt(inWeeks[1], 10) * 7));
    notes.push(`deadline in ${deadlineDays} days from "${inWeeks[0]}"`);
  } else if (byDate?.[1] !== undefined) {
    const target = Date.parse(`${byDate[1]}T00:00:00.000Z`);
    if (Number.isFinite(target) && target > nowMs) {
      deadlineDays = Math.min(365, Math.max(1, Math.ceil((target - nowMs) / 86_400_000)));
      notes.push(`deadline ${byDate[1]} (${deadlineDays} days out)`);
    } else {
      notes.push(`deadline "${byDate[1]}" is past or invalid; defaulted to 30 days`);
    }
  } else {
    notes.push("deadline defaulted to 30 days (no match)");
  }

  // Categories from keyword hits.
  const categories = [...new Set(
    CATEGORY_KEYWORDS.filter(([re]) => re.test(text)).map(([, c]) => c),
  )];
  if (categories.length === 0) {
    categories.push("general");
    notes.push("category defaulted to general (no keyword hit)");
  } else {
    notes.push(`categories: ${categories.join(", ")}`);
  }

  // Merchant constraints: "only from X", "not from Y", "no <name>".
  const allowMerchants: string[] = [];
  const denyMerchants: string[] = [];
  for (const m of text.matchAll(/only\s+from\s+([A-Za-z0-9][A-Za-z0-9 ._-]{1,40})/gi)) {
    const name = m[1]?.trim().replace(/[.\s]+$/, "");
    if (name) allowMerchants.push(name);
  }
  for (const m of text.matchAll(/(?:not\s+from|no\s+|exclude\s+|avoid\s+)([A-Za-z][A-Za-z0-9 ._-]{1,40}?)(?:[.,;]|$)/gi)) {
    const name = m[1]?.trim();
    if (name && !/^(more|less|extra|additional)\b/i.test(name)) denyMerchants.push(name);
  }
  if (allowMerchants.length > 0) notes.push(`allow merchants: ${allowMerchants.join(", ")}`);
  if (denyMerchants.length > 0) notes.push(`deny merchants: ${denyMerchants.join(", ")}`);

  // Mandatory terms: "must (have|include|support) X", "requires X".
  const mandatory: string[] = [];
  for (const m of text.matchAll(/must\s+(?:have|include|support|be)\s+([^.,;]{3,80})/gi)) {
    const term = m[1]?.trim();
    if (term) mandatory.push(term);
  }
  if (mandatory.length > 0) notes.push(`mandatory: ${mandatory.join("; ")}`);

  return {
    quantity, budgetMinor, currency, categories, deadlineDays,
    allowMerchants, denyMerchants, mandatory, notes,
  };
}

const INJECTION_PATTERNS: [RegExp, string][] = [
  [/ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i, "instruction-override"],
  [/disregard\s+(the\s+)?(policy|policies|rules?|approval)/i, "policy-override"],
  [/change\s+(the\s+)?merchant\s+to/i, "merchant-swap"],
  [/new\s+merchant\s*:/i, "merchant-swap"],
  [/increase\s+(the\s+)?(amount|total|price)/i, "amount-increase"],
  [/approve\s+(this\s+)?without\s+(approval|review|asking)/i, "approval-bypass"],
  [/override\s+(the\s+)?(policy|approval|limit)/i, "policy-override"],
  [/send\s+(the\s+)?(money|funds|payment)\s+to\s+(?!.*authorized)/i, "payee-redirect"],
  [/system\s*:\s*you\s+are\s+now/i, "role-hijack"],
];

/** Scan untrusted text (e.g. merchant descriptions) for injection markers. */
export function scanInjection(text: string): { matched: boolean; signals: string[] } {
  const signals = [...new Set(
    INJECTION_PATTERNS.filter(([re]) => re.test(text)).map(([, s]) => s),
  )];
  return { matched: signals.length > 0, signals };
}
