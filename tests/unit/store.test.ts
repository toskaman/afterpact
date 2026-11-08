import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../../apps/api/src/store";

const EMPTY_PAYMENT = { orders: [], captures: [], refunds: [], operations: [], idempotency: [] };

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), "afterpact-store-"));
}

function fileIn(dir: string): string {
  return join(dir, "afterpact.json");
}

describe("AppStore snapshot durability (T3 persistence Option B)", () => {
  it("rotates the previous generation to .bak on write", () => {
    const file = fileIn(freshDir());
    const store = new AppStore(file);
    store.writeNow(EMPTY_PAYMENT);
    store.writeNow(EMPTY_PAYMENT);
    expect(JSON.parse(readFileSync(`${file}.bak`, "utf8")).version).toBe(1);
  });

  it("loads the backup generation when the main file is corrupt", () => {
    const file = fileIn(freshDir());
    const store = new AppStore(file);
    store.intents.set("a", { id: "a" } as never);
    store.writeNow(EMPTY_PAYMENT);
    store.intents.set("b", { id: "b" } as never);
    store.writeNow(EMPTY_PAYMENT);
    writeFileSync(file, "{corrupt-json!!!");
    const recovered = new AppStore(file);
    expect(recovered.intents.has("a")).toBe(true);
    expect(recovered.intents.has("b")).toBe(false);
  });

  it("fails closed when both main and backup are unusable", () => {
    const file = fileIn(freshDir());
    writeFileSync(file, "{corrupt-json!!!");
    expect(() => new AppStore(file)).toThrow();
  });

  it("rejects a shapeless snapshot with a clear error", () => {
    const file = fileIn(freshDir());
    writeFileSync(file, JSON.stringify({ version: 1 }));
    expect(() => new AppStore(file)).toThrow(/invalid snapshot shape/);
  });
});
