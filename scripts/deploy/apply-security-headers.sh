#!/bin/bash
set -euo pipefail

#===============================================================================
# BC Charge – Apply/refresh Nginx security headers (idempotent)
#
# Usage (on production as root):
#   sudo ./scripts/deploy/apply-security-headers.sh
#
# Copies the header snippet, ensures the active site config includes it on
# server + critical locations, nginx -t, reload.
#===============================================================================

APP_DIR="${APP_DIR:-/opt/bc-charge}"
SITE_AVAILABLE="${SITE_AVAILABLE:-/etc/nginx/sites-available/bc-charge}"
SNIPPET_DST="/etc/nginx/snippets/bc-charge-security-headers.conf"
SNIPPET_SRC="${APP_DIR}/scripts/deploy/snippets/bc-charge-security-headers.conf"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[SecHeaders]${NC} $1"; }
warn() { echo -e "${YELLOW}[Hinweis]${NC} $1"; }
err() { echo -e "${RED}[Fehler]${NC} $1"; exit 1; }

if [[ $EUID -ne 0 ]]; then
  err "Bitte als root: sudo $0"
fi

if [[ ! -f "$SNIPPET_SRC" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "$SCRIPT_DIR/snippets/bc-charge-security-headers.conf" ]]; then
    SNIPPET_SRC="$SCRIPT_DIR/snippets/bc-charge-security-headers.conf"
  else
    err "Snippet nicht gefunden: $SNIPPET_SRC"
  fi
fi

mkdir -p /etc/nginx/snippets
cp "$SNIPPET_SRC" "$SNIPPET_DST"
log "Snippet → $SNIPPET_DST"

if [[ ! -f "$SITE_AVAILABLE" ]]; then
  err "Nginx-Site fehlt: $SITE_AVAILABLE"
fi

BACKUP="${SITE_AVAILABLE}.bak.$(date +%Y%m%d%H%M%S)"
cp "$SITE_AVAILABLE" "$BACKUP"
log "Backup → $BACKUP"

INCLUDE_LINE='include /etc/nginx/snippets/bc-charge-security-headers.conf;'

python3 - "$SITE_AVAILABLE" "$INCLUDE_LINE" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
include_stmt = sys.argv[2].strip()
text = path.read_text()
lines = text.splitlines(keepends=True)
out = []
i = 0
server_include_added = False

def line_has_include(s: str) -> bool:
    return "bc-charge-security-headers.conf" in s

while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # Inject into location blocks that open with {
    if stripped.startswith("location ") and stripped.endswith("{"):
        out.append(line)
        depth = 1
        j = i + 1
        block = []
        while j < len(lines) and depth > 0:
            cur = lines[j]
            depth += cur.count("{")
            depth -= cur.count("}")
            if depth > 0:
                block.append(cur)
            else:
                # closing brace of this location
                block_text = "".join(block)
                if not line_has_include(block_text):
                    indent = "        "
                    # match indentation of previous non-empty block line if possible
                    for prev in reversed(block):
                        if prev.strip():
                            indent = prev[: len(prev) - len(prev.lstrip())]
                            break
                    block.append(f"{indent}{include_stmt}\n")
                out.extend(block)
                out.append(cur)
            j += 1
        i = j
        continue

    out.append(line)
    i += 1

text2 = "".join(out)

# Ensure at least one server-level include before the final closing brace
if "bc-charge-security-headers.conf" not in text2:
    lines2 = text2.splitlines(keepends=True)
    last = None
    for idx in range(len(lines2) - 1, -1, -1):
        if lines2[idx].strip() == "}":
            last = idx
            break
    if last is None:
        raise SystemExit("no closing brace found in nginx site config")
    lines2.insert(last, f"    {include_stmt}\n")
    text2 = "".join(lines2)
    server_include_added = True
else:
    # If only location includes exist, also add server-level once (harmless duplicate ok;
    # prefer single server-level when no locations were patched — already handled).
    pass

path.write_text(text2)
print(f"patched {path} server_include_forced={server_include_added}")
PY

nginx -t
systemctl reload nginx
log "nginx reloaded."

echo ""
log "Lokal (Origin):"
curl -sI http://127.0.0.1/ 2>/dev/null | grep -iE 'HTTP/|strict-transport|content-security|x-frame|x-content|referrer-policy|permissions-policy' || true

echo ""
log "Öffentlich prüfen:"
echo "  curl -sI https://main.bc-charge.com/ | grep -iE 'strict-transport|content-security|x-frame|x-content|referrer-policy|permissions-policy'"
echo "  https://securityheaders.com/?q=https://main.bc-charge.com&followRedirects=on"
