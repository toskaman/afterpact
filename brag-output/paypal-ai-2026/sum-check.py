import json, sys
raw = sys.stdin.read()
start = raw.find("{")
d = json.loads(raw[start:])
print("ok=", d.get("ok"), "errors=", d.get("errorCount"), "warnings=", d.get("warningCount"))
for f in d.get("findings", [])[:25]:
    msg = str(f.get("message", ""))[:160].replace("\n", " ")
    print(f.get("severity", "?"), "|", f.get("rule", "?"), "|", msg)
for key in ("lint", "runtime", "layout", "motion", "contrast"):
    sec = d.get(key)
    if isinstance(sec, dict):
        print(key, "errors=", sec.get("errorCount"), "warnings=", sec.get("warningCount"))
