import json, sys
raw = sys.stdin.read()
d = json.loads(raw[raw.find("{"):])
for key in ("layout", "contrast"):
    sec = d.get(key, {})
    for f in sec.get("findings", []):
        if f.get("severity") in ("error", "warning"):
            print("=" * 60)
            print(json.dumps(f, indent=1)[:900])
