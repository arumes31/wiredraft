#!/usr/bin/env bash
set -euo pipefail

target="internal/model/validation.go"
backup="$(mktemp)"
cp "$target" "$backup"
restore() { cp "$backup" "$target"; rm -f "$backup"; }
trap restore EXIT

# Boundary mutation: VLAN 4094 must remain valid. The edge-case suite must kill
# this mutant by failing after > becomes >=.
python - "$target" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text(encoding="utf-8")
needle = "if v.ID < 1 || v.ID > 4094 {"
mutant = "if v.ID < 1 || v.ID >= 4094 {"
if source.count(needle) != 1:
    raise SystemExit("mutation target changed; update mutation-smoke.sh")
path.write_text(source.replace(needle, mutant), encoding="utf-8")
PY

if go test ./internal/model >/dev/null 2>&1; then
  echo "mutation survived: VLAN upper-bound tests did not detect >= 4094"
  exit 1
fi
echo "mutation killed: VLAN upper-bound regression detected"
