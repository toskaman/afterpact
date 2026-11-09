"""Generate frame-accurate SRT + narration TXT from composition VO placement + vo-lines.json."""
import json, re, sys, pathlib

BASE = pathlib.Path(__file__).parent
index = (BASE / "composition" / "index.html").read_text(encoding="utf-8")
lines = {l["id"]: l["text"] for l in json.loads((BASE / "vo-lines.json").read_text(encoding="utf-8"))["lines"]}

clips = []
for m in re.finditer(r'<audio id="vo-(L\d+)" data-start="([\d.]+)" data-duration="([\d.]+)"', index):
    lid, start, dur = m.group(1), float(m.group(2)), float(m.group(3))
    clips.append((start, start + dur, lid))
clips.sort()
assert len(clips) == 25, f"expected 25 VO clips, got {len(clips)}"
missing = [lid for _, _, lid in clips if lid not in lines]
assert not missing, f"missing texts: {missing}"


def ts(sec: float) -> str:
    if sec < 0:
        sec = 0
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int(round((sec - int(sec)) * 1000))
    if ms == 1000:
        s += 1
        ms = 0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def wrap(text: str, width: int = 42) -> str:
    words, rows, cur = text.split(), [], ""
    for w in words:
        if len(cur) + 1 + len(w) > width and cur:
            rows.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    rows.append(cur)
    # keep max 2 rows: merge overflow into row 2
    while len(rows) > 2:
        rows[-2] = rows[-2] + " " + rows[-1]
        rows.pop()
    return "\n".join(rows)


srt, nar = [], []
for i, (start, end, lid) in enumerate(clips):
    nxt = clips[i + 1][0] if i + 1 < len(clips) else 137.0
    end = min(end + 0.25, nxt - 0.08)  # small padding, never overlap next cue
    if end <= start:
        end = start + 0.5
    srt.append(f"{i + 1}\n{ts(start)} --> {ts(end)}\n{wrap(lines[lid])}\n")
    nar.append(f"[{ts(start)}] {lid}: {lines[lid]}")

(BASE / "AFTERPACT_PAYPAL_AI_FINAL.srt").write_text("\n".join(srt), encoding="utf-8")
(BASE / "NARRATION_EN.txt").write_text(
    "AFTERPACT — PayPal AI Hackathon 2026 submission film narration (EN, Kokoro af_heart)\n"
    + "\n".join(nar) + "\n",
    encoding="utf-8",
)
print(f"cues={len(clips)} first={ts(clips[0][0])} last_end={ts(end)}")
