#!/bin/bash
# AFTERPACT demo deploy (Vultr VM, Ubuntu 24.04). Idempotent-ish: safe to
# re-run; it rebuilds from the public repo tip.
# Demo runs on MOCK transport (no secrets on this box). No .env is created.
set -eux
export DEBIAN_FRONTEND=noninteractive
DOMAIN="199.247.9.188.nip.io"

# Vultr Ubuntu images ship with ufw active + SSH-only: open web ports or
# ACME challenges (and judges) cannot reach Caddy.
if command -v ufw >/dev/null; then
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

apt-get update
apt-get install -y curl git ca-certificates gnupg

# Node.js 24 LTS
if ! command -v node >/dev/null || ! node --version | grep -q '^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

# Caddy (TLS reverse proxy)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

# App (public repo, no secrets)
if [ -d /opt/afterpact/repo/.git ]; then
  git -C /opt/afterpact/repo fetch origin
  git -C /opt/afterpact/repo reset --hard origin/main
else
  git clone https://github.com/toskaman/afterpact /opt/afterpact/repo
fi
cd /opt/afterpact/repo
npm ci --no-audit --no-fund
npm run build
npm test 2>&1 | tail -4
# Writable snapshot dir for the www-data service (store resolves <repo>/data)
mkdir -p /opt/afterpact/repo/data
chown -R www-data:www-data /opt/afterpact/repo/data

# Operator token for destructive routes (printed once, stored only on the box)
OPERATOR_TOKEN="$(openssl rand -hex 24)"

# systemd service (mock transport: no payment credentials in env)
cat > /etc/systemd/system/afterpact.service <<EOF
[Unit]
Description=AFTERPACT demo (mock transport, no secrets)
After=network.target
[Service]
Type=simple
WorkingDirectory=/opt/afterpact/repo
Environment=PORT=3001
Environment=LOG_LEVEL=info
Environment=PAYPAL_MODE=sandbox
Environment=OPERATOR_TOKEN=$OPERATOR_TOKEN
ExecStart=/usr/bin/node /opt/afterpact/repo/apps/api/dist/apps/api/src/index.js
Restart=on-failure
RestartSec=5
User=www-data
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now afterpact.service
# --now does not restart an already-running service: force the new build live.
systemctl restart afterpact.service

# Caddy: HTTPS with automatic certs
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  reverse_proxy 127.0.0.1:3001
}
EOF
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy

# Local verify (Caddy may need ~30s for first ACME cert)
sleep 5
curl -sf http://127.0.0.1:3001/api/health
echo
echo "DEPLOY_OK $DOMAIN"
echo "OPERATOR_TOKEN=$OPERATOR_TOKEN (save it: required for /api/demo/reset and /api/admin/kill-switch)"
