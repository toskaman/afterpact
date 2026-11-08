export type AIErrorCode =
  | "ai-config"
  | "ai-timeout"
  | "ai-transport"
  | "ai-invalid-output"
  | "ai-model-mismatch"
  | "ai-rate-limited"
  | "ai-disabled";

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AIError";
  }
}

export class AIConfigError extends AIError {
  constructor(message: string) {
    super(message, "ai-config");
    this.name = "AIConfigError";
  }
}

export class AITimeoutError extends AIError {
  constructor(
    public readonly timeoutMs: number,
    message = `inference timed out after ${timeoutMs}ms`,
  ) {
    super(message, "ai-timeout", { timeoutMs });
    this.name = "AITimeoutError";
  }
}

export class AITransportError extends AIError {
  constructor(
    message: string,
    public readonly httpStatus: number | null,
    details?: unknown,
  ) {
    super(message, httpStatus === 429 ? "ai-rate-limited" : "ai-transport", {
      httpStatus,
      ...(typeof details === "object" && details !== null ? details : {}),
    });
    this.name = "AITransportError";
  }
}

export class AIInvalidOutputError extends AIError {
  constructor(
    message: string,
    public readonly issues: unknown,
    public readonly attempts: number,
  ) {
    super(message, "ai-invalid-output", { issues, attempts });
    this.name = "AIInvalidOutputError";
  }
}

/**
 * The served model differs from the requested one. Vultr documents that an
 * unknown model id may silently fall back to a default — never report a
 * requested model as executed without this check passing.
 */
export class AIModelMismatchError extends AIError {
  constructor(
    public readonly requested: string,
    public readonly served: string,
  ) {
    super(
      `model identity mismatch: requested ${requested}, served ${served}`,
      "ai-model-mismatch",
      { requested, served },
    );
    this.name = "AIModelMismatchError";
  }
}

export class AINotConfiguredError extends AIError {
  constructor(message = "no AI provider configured") {
    super(message, "ai-disabled");
    this.name = "AINotConfiguredError";
  }
}
