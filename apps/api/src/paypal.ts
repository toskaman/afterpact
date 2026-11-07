import {
  fromEnv,
  hasLiveCredentials,
  HttpPayPalTransport,
  MockPayPalTransport,
  PaymentAuditLog,
  PaymentStore,
  PayPalService,
  type PayPalEnv,
  type PayPalTransport,
} from "../../../packages/payments/src/index";

export type TransportKind = "mock-simulated" | "paypal-sandbox-live";

export interface PayPalWiring {
  service: PayPalService;
  store: PaymentStore;
  audit: PaymentAuditLog;
  transport: PayPalTransport;
  mock: MockPayPalTransport | null;
  kind: TransportKind;
  env: PayPalEnv;
}

/**
 * Transport selection is explicit and observable: live-sandbox HTTP only when
 * real credentials are present, otherwise the deterministic mock. The active
 * kind is returned on every payment response and in /api/health so the UI
 * can badge real-vs-simulated without guessing.
 */
export function wirePayments(processEnv: NodeJS.ProcessEnv = process.env): PayPalWiring {
  const env = fromEnv(processEnv);
  const store = new PaymentStore();
  const audit = new PaymentAuditLog((entry) => {
    if ((processEnv["LOG_LEVEL"] ?? "info") !== "silent") {
      console.log(JSON.stringify({ log: "payments", level: entry.level, msg: entry.message, seq: entry.seq }));
    }
  });
  let transport: PayPalTransport;
  let mock: MockPayPalTransport | null = null;
  let kind: TransportKind = "mock-simulated";
  if (hasLiveCredentials(env)) {
    transport = new HttpPayPalTransport(env.config, env.credentials);
    kind = "paypal-sandbox-live";
  } else {
    mock = new MockPayPalTransport(env.mockWebhookSecret || "test-secret");
    transport = mock;
  }
  const service = new PayPalService({ config: env.config, transport, store, audit });
  return { service, store, audit, transport, mock, kind, env };
}
