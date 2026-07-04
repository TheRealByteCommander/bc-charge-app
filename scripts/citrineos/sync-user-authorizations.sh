#!/bin/bash
# BC-Nutzer membershipId → CitrineOS Authorizations (einmalig nach Deploy)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
node scripts/citrineos/sync-user-authorizations.mjs
