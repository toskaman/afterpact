# Usability facilitation pack (print-and-run, 30 min)

Companion to `USABILITY_STUDY.md` (the protocol + scenarios S1–S5). For the
owner/facilitator: recruit 1–5 people with ops/support/e-commerce exposure,
get consent, run the script below verbatim, and send the notes back so §6
gets real rows. Zero sessions to date — do not pre-fill results.

## Before the session

- Reset the demo box state for the participant (Demo view → reset your own
  runs; never touch other visitors' runs).
- Open `#/judge` on the participant's screen. Have this pack + a timer ready.
- Participant ID: `P1`, `P2`, … (never record names in study notes).

## Intro script (read aloud, ~60 s)

> "AFTERPACT checks whether online purchases actually delivered what was
> promised, and helps fix the gap safely. You'll do 2–3 short tasks on a
> demo with fake money. There are no wrong clicks that break anything —
> think aloud: tell me what you see, what you expect, and what confuses
> you. I can't help during tasks, but I'll answer everything afterwards."

## Consent script (read aloud, record yes/no)

> "May I time each task, take notes on errors and confusion, and
> [screen-record] this session for product improvement? Notes are
> anonymized as P1/P2 with your role only (e.g. 'support agent'). You can
> stop at any time and I'll delete your notes."

- Consent: time-notes Y/N · quotes Y/N · screen-record Y/N.

## Task prompts (read verbatim, start the clock)

Run S1 + S5 + one of S2/S3/S4 (protocol §2 has ground truth + completion
criteria for all five):

- **T1 (S1):** "A customer ordered 3 sensor kits but only 2 arrived. Using
  this screen, find what refund AFTERPACT recommends and show me the proof
  the provider paid it." (expected: 1/3 share to the cent + refund id)
- **T2 (S5):** "The carrier says delivered, the buyer says not received.
  Show me what AFTERPACT knows and tell me what YOU would do next."
  (expected: both evidence items cited, escalate, no refund)
- **T3 (S2/S3/S4):** pick from protocol §2; expected outcomes listed there.

Per task record: start/end time, completion (yes/no/partial), wrong turns
(quoted), confusing control names, confidence 1–5 ("how sure are you this
is right?").

## Closing questions (after the clock stops)

1. "In one sentence, what does AFTERPACT do?"
2. "What did you trust least on screen, and why?"
3. "What would stop you from using this at work?"
4. "What should we rename, move, or delete?"

## What to send back

For each participant: the per-task rows above + answers to 1–4 + the
consent record. The agent appends them to `USABILITY_STUDY.md` §6 and
updates the Devpost Impact section with measured (not estimated) numbers.
Negative results are first-class: confusion and distrust get recorded,
not smoothed over.
