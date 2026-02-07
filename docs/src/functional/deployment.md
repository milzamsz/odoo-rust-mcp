# Deployment

How to deploy odoo-rust-mcp in production environments.

---

## Deployment Options

| Method | Best For |
|--------|----------|
| [Direct binary](#direct-binary) | Simple setups, development |
| [Install script](#install-script) | Linux/macOS with systemd/launchd |
| [Docker](#docker) | Single-server production |
| [Docker Compose](#docker-compose) | Multi-service stacks (n8n, Dify) |
| [Kubernetes](#kubernetes) | Cluster deployments |
| [Helm](#helm-chart) | Templated Kubernetes deployments |

---

## Direct Binary

Download a pre-built binary from [GitHub Releases](https://github.com/rachmataditiya/odoo-rust-mcp/releases) or [build from source](../developer/building.md).

```bash
# stdio transport (for AI clients like Cursor, Claude Desktop)
./rust-mcp --transport stdio

# HTTP transport (for remote access + Config UI)
./rust-mcp --transport http --listen 127.0.0.1:8787

# WebSocket transport
./rust-mcp --transport ws --listen 127.0.0.1:8787
```

When using HTTP or WebSocket transport, the Config UI is available at `http://localhost:3008`.

---

## Install Script

The included `install.sh` script handles binary installation and service setup:

```bash
# Download and extract a release, then:
./install.sh              # Install binary + config files
./install.sh service      # Install + start as background service
./install.sh uninstall    # Remove everything
```

The script auto-detects the OS and installs the appropriate service (systemd on Linux, launchd on macOS).

### Custom Install Prefix

```bash
# Install to user-local directory (no sudo needed)
PREFIX=$HOME/.local ./install.sh
```

---

## Linux (systemd)

### Using the Install Script

```bash
./install.sh service
```

This creates:
- Binary at `/usr/local/bin/rust-mcp`
- Config at `/usr/local/share/odoo-rust-mcp/`
- Environment file at `/usr/local/etc/odoo-rust-mcp.env`
- Systemd unit at `/etc/systemd/system/odoo-rust-mcp.service`

### Manual systemd Setup

Create `/etc/systemd/system/odoo-rust-mcp.service`:

```ini
[Unit]
Description=Odoo Rust MCP Server
After=network.target

[Service]
Type=simple
User=nobody
Group=nogroup
EnvironmentFile=/usr/local/etc/odoo-rust-mcp.env
ExecStart=/usr/local/bin/rust-mcp --transport http --listen 127.0.0.1:8787
Restart=on-failure
RestartSec=5

# Security hardening
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable odoo-rust-mcp
sudo systemctl start odoo-rust-mcp

# Check status
sudo systemctl status odoo-rust-mcp

# View logs
sudo journalctl -u odoo-rust-mcp -f
```

---

## macOS (launchd)

### Using the Install Script

```bash
./install.sh service
```

This creates:
- Binary at `/usr/local/bin/rust-mcp`
- Config at `~/.config/odoo-rust-mcp/`
- Plist at `~/Library/LaunchAgents/com.odoo.rust-mcp.plist`

### Managing the Service

```bash
# Start
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.odoo.rust-mcp.plist

# Stop
launchctl bootout gui/$(id -u)/com.odoo.rust-mcp

# Status
launchctl print gui/$(id -u)/com.odoo.rust-mcp

# Logs
tail -f ~/.config/odoo-rust-mcp/stdout.log
```

---

## Windows

### PowerShell Install Script

```powershell
# Run as Administrator
.\scripts\install.ps1
```

### Manual Setup

1. Download the Windows binary from GitHub Releases
2. Place `rust-mcp.exe` in a permanent location (e.g., `%LOCALAPPDATA%\odoo-rust-mcp\`)
3. Copy `static/dist/` alongside the binary for Config UI
4. Add the directory to your `PATH`
5. Create `~/.config/odoo-rust-mcp/instances.json` with your Odoo credentials

### Running as a Background Process

```powershell
# Start in background
Start-Process -NoNewWindow rust-mcp -ArgumentList "--transport","http","--listen","127.0.0.1:8787"
```

For a persistent Windows service, use [NSSM](https://nssm.cc/) or Task Scheduler.

---

## Docker

### Single Container

```bash
docker build -f rust-mcp/Dockerfile -t odoo-rust-mcp:latest .

docker run -d \
  --name odoo-mcp \
  -p 8787:8787 \
  -p 3008:3008 \
  -e ODOO_URL=http://host.docker.internal:8069 \
  -e ODOO_DB=mydb \
  -e ODOO_API_KEY=your-key \
  -e CONFIG_UI_USERNAME=admin \
  -e CONFIG_UI_PASSWORD=changeme \
  odoo-rust-mcp:latest
```

### Container Details

| Feature | Value |
|---------|-------|
| Base image | `debian:bookworm-slim` |
| User | `mcp` (non-root) |
| MCP port | 8787 |
| Config UI port | 3008 |
| Config path | `/config/` |
| Health check | `POST /mcp` (ping) |
| Default transport | HTTP on `0.0.0.0:8787` |

---

## Docker Compose

### Basic Setup

```bash
# Create .env from example
cp dotenv.example .env
# Edit .env with your credentials

# Build and run
docker compose up -d
```

### Multi-Instance Configuration

Create `instances.json` in the project root:

```json
{
  "production": {
    "url": "http://host.docker.internal:8069",
    "db": "production",
    "apiKey": "your-api-key"
  },
  "staging": {
    "url": "http://staging.example.com:8069",
    "db": "staging",
    "version": "18",
    "username": "admin",
    "password": "admin"
  }
}
```

The `docker-compose.yml` mounts this file automatically.

### Integration with Other Containers

The compose file creates an `mcp-network` bridge network. Other containers (n8n, Dify, etc.) can connect to the MCP server:

```yaml
# In another docker-compose.yml
services:
  n8n:
    networks:
      - mcp-network
    environment:
      MCP_URL: http://odoo-mcp:8787/mcp

networks:
  mcp-network:
    external: true
```

### Traefik Reverse Proxy

The compose file includes Traefik labels:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.odoo-mcp.rule=Host(`mcp.localhost`)"
  - "traefik.http.services.odoo-mcp.loadbalancer.server.port=8787"
  - "traefik.http.routers.odoo-mcp-config.rule=Host(`mcp-config.localhost`)"
  - "traefik.http.services.odoo-mcp-config.loadbalancer.server.port=3008"
```

### Resource Limits

Default limits in the compose file:

| Resource | Limit | Reservation |
|----------|-------|-------------|
| CPU | 1 core | 0.25 cores |
| Memory | 256 MB | 64 MB |

---

## Kubernetes

The `k8s/` directory contains 7 manifests managed by Kustomize:

```
k8s/
+-- kustomization.yaml   # Kustomize configuration
+-- namespace.yaml       # odoo-mcp namespace
+-- configmap.yaml       # tools.json, prompts.json, server.json, instances.json
+-- secret.yaml          # API keys, auth tokens, Config UI credentials
+-- deployment.yaml      # 2 replicas, probes, anti-affinity, security context
+-- service.yaml         # ClusterIP with ports 8787 + 3008
+-- ingress.yaml         # nginx ingress with TLS (optional)
```

### Quick Deploy

```bash
# Apply all manifests
kubectl apply -k k8s/

# Check status
kubectl get pods -n odoo-mcp
kubectl logs -f deployment/odoo-mcp -n odoo-mcp
```

### Customization with Overlays

```bash
# Create a production overlay
mkdir -p k8s/overlays/production
cat > k8s/overlays/production/kustomization.yaml <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../
patches:
  - patch: |-
      - op: replace
        path: /spec/replicas
        value: 3
    target:
      kind: Deployment
      name: odoo-mcp
EOF

kubectl apply -k k8s/overlays/production
```

### Key Deployment Features

- **Non-root execution**: `runAsUser: 1000`, `readOnlyRootFilesystem: true`
- **Pod anti-affinity**: Spreads replicas across nodes
- **Three-probe health checks**: startup, liveness, readiness
- **Resource limits**: 100m-500m CPU, 64Mi-256Mi memory
- **Config via ConfigMap**: Hot-reloadable tool/prompt definitions
- **Secrets from Secret**: API keys, auth tokens via `secretKeyRef`

---

## Helm Chart

The `helm/odoo-rust-mcp/` directory contains a full Helm chart.

### Install

```bash
helm install odoo-mcp helm/odoo-rust-mcp/ \
  --set odoo.url=http://odoo-service:8069 \
  --set odoo.db=production \
  --set odoo.apiKey=your-api-key
```

### Multi-Instance Install

```bash
helm install odoo-mcp helm/odoo-rust-mcp/ \
  -f my-values.yaml
```

Where `my-values.yaml` contains:

```yaml
odooInstances:
  json: |
    {
      "production": {
        "url": "http://odoo-service:8069",
        "db": "production",
        "apiKey": "your-production-key"
      },
      "staging": {
        "url": "http://odoo-staging:8069",
        "db": "staging",
        "apiKey": "your-staging-key"
      }
    }

mcp:
  auth:
    enabled: true
    token: "your-secure-token"

configServer:
  enabled: true
  auth:
    username: admin
    password: "strong-password"

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: mcp.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: odoo-mcp-tls
      hosts:
        - mcp.example.com
```

### Key Helm Values

| Value | Default | Description |
|-------|---------|-------------|
| `replicaCount` | 2 | Number of replicas |
| `image.repository` | `ghcr.io/milzamsz/odoo-rust-mcp` | Container image |
| `odooInstances.json` | (example) | Multi-instance JSON config |
| `mcp.auth.enabled` | false | Enable HTTP auth |
| `mcp.auth.token` | "" | Bearer token |
| `configServer.enabled` | true | Enable Config UI |
| `configServer.port` | 3008 | Config UI port |
| `autoscaling.enabled` | false | Enable HPA |
| `autoscaling.maxReplicas` | 10 | Max replicas |
| `ingress.enabled` | false | Enable ingress |

### Autoscaling

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
```

---

## Production Checklist

### Security

- [ ] Change default Config UI credentials (`CONFIG_UI_USERNAME`, `CONFIG_UI_PASSWORD`)
- [ ] Enable MCP HTTP auth (`MCP_AUTH_ENABLED=true`) and set a strong token
- [ ] Use HTTPS via reverse proxy (Traefik, nginx, etc.)
- [ ] Bind to `127.0.0.1` if only local access is needed
- [ ] Run as non-root user
- [ ] Use read-only root filesystem (Docker/K8s)

### Performance

- [ ] Set appropriate `ODOO_TIMEOUT_MS` (default: 30000ms)
- [ ] Set `ODOO_MAX_RETRIES` for unreliable networks
- [ ] Configure resource limits (CPU/memory)
- [ ] Use `RUST_LOG=info` in production (not `debug`)

### Monitoring

- [ ] Configure health check probes
- [ ] Monitor `GET /health` (MCP server) and `GET /health` (Config UI)
- [ ] Set up log aggregation (`RUST_LOG=info` outputs to stdout/stderr)

### Configuration

- [ ] Use `instances.json` file for multi-instance setups (not inline env vars)
- [ ] Mount config files as read-only volumes
- [ ] Use secrets management for API keys (K8s Secrets, Docker secrets, vault)
