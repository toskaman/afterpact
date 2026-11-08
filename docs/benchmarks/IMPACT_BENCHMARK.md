# AFTERPACT impact benchmark

Reproducible timing harness for the "measurable evidence" bar. Rows
below marked MACHINE-RECORDED came from `node scripts/bench.mjs`
against the stated build + machine; anything else is an explicit
estimate. **Never paste numbers by hand.**

## Method

```bash
npm run build
PORT=3101 AFTERPACT_DATA_DIR=':memory:' npm start &
node scripts/bench.mjs --base http://localhost:3101 --runs 5 --record
```

Each metric reports the median of N runs on one machine. Record the
build (commit), transport, Node version, and platform with every row.
Benchmarks measure the mock transport unless stated; sandbox timings
depend on PayPal latency and are reported separately when keyed.

## What we measure (and why it matters)

| Metric | Why a merchant-ops team cares |
|---|---|
| Flagship demo (9 acts) | Full incident-to-recovery loop latency |
| Studio datasets | Analytics refresh cost over live state |
| Studio NL command | Operator query latency (`incidents unresolved refunds >$100`) |
| Recovery timeline | Schedule recomputation after state change |
| Audit export | Evidence-bundle generation for disputes |

## Results

| Date | Transport | Node | Medians |
|---|---|---|---|
| 2026-11-07 | mock-simulated, win32/x64 | v24.14.1 | flagship demo (9 acts): 6.2ms · studio datasets: 1.1ms · studio NL command: 0.9ms · recovery timeline: 0.6ms · audit export: 1.2ms (median of 5, machine-recorded) |
