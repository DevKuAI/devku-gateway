<p align="center">
  <img alt="Gateway logo" src="docs/logo.svg" width="96">
</p>

<h1 align="center">
  Gateway
</h1>

<p align="center">
  A high-performance, lightweight AI gateway with OpenAI-compatible APIs.
</p>

<p align="center">
  <a href="https://github.com/DevKuAI/devku-gateway/actions/workflows/test.yml"><img alt="CI" src="https://github.com/DevKuAI/devku-gateway/actions/workflows/test.yml/badge.svg"></a>
  <a href="https://github.com/DevKuAI/devku-gateway/blob/main/go.mod"><img alt="GO Version" src="https://img.shields.io/github/go-mod/go-version/DevKuAI/devku-gateway?label=GO"></a>
  <a href="https://hub.docker.com/r/huanghua581/devku-gateway"><img alt="Docker Pulls" src="https://img.shields.io/docker/pulls/huanghua581/devku-gateway"></a>
</p>

<p align="center">
  <a href="./docs/getting-started/quickstart.mdx">Documentation</a> |
  <a href="./docs/advanced/configuration.mdx">Configuration</a> |
  <a href="https://hub.docker.com/r/huanghua581/devku-gateway">Docker Hub</a> |
  <a href="https://github.com/DevKuAI/devku-gateway">Repository</a> |
  <a href="https://github.com/ENTERPILOT/GoModel">Original upstream</a>
</p>

Gateway routes requests to multiple AI model providers through a single API. It
adds provider routing, failover, budgets, rate limits, caching, usage tracking,
guardrails, virtual models, and an operations dashboard without requiring client
applications to adopt a provider-specific API.

> [!NOTE]
> Gateway is maintained by [DevKuAI](https://github.com/DevKuAI) as a downstream
> distribution of the original
> [ENTERPILOT/GoModel](https://github.com/ENTERPILOT/GoModel) project. Upstream
> application logic is synchronized into this repository, while Gateway keeps
> its own product name, distribution artifacts, and admin experience.

## Quick Start

### 1. Install and start Gateway

**macOS and Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/DevKuAI/devku-gateway/main/docs/install/install.sh | sh
# Optional; providers can also be added in the dashboard.
export OPENAI_API_KEY="your-openai-key"
gateway
```

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/DevKuAI/devku-gateway/main/docs/install/install.ps1 | iex
# Optional; providers can also be added in the dashboard.
$env:OPENAI_API_KEY = "your-openai-key"
gateway
```

**Docker**

```bash
docker pull huanghua581/devku-gateway:latest
docker run --rm -p 8080:8080 \
  -e OPENAI_API_KEY="your-openai-key" \
  huanghua581/devku-gateway:latest
```

Gateway can be configured with environment variables, `config.yaml`, or the
dashboard. Environment variables override YAML settings. See
[`.env.template`](./.env.template) for the complete list.

For production, set `ADMIN_PASSWORD` and `GOMODEL_MASTER_KEY`, then provide
provider credentials through environment variables or your secret manager. The
default admin password is `password` and is intended only for local setup.

### 2. Open the dashboard

```text
http://localhost:8080/admin/dashboard
```

Sign in with the configured `ADMIN_PASSWORD`, then add or verify a provider.

### 3. Make your first API call

```bash
curl http://localhost:8080/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5-chat-latest",
    "input": "Hello!"
  }'
```

When `GOMODEL_MASTER_KEY` is configured, add
`-H "Authorization: Bearer $GOMODEL_MASTER_KEY"` to the request.

## Using Gateway with official SDKs

Gateway exposes an OpenAI-compatible API at `/v1` and an Anthropic-compatible
API at `/v1/messages`, so the official SDKs work unchanged - just point the
base URL at your Gateway server and use your Gateway key
(set up with the `GOMODEL_MASTER_KEY` env variable or one generated in the dashboard).

### OpenAI SDK

**Python**

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",  # your Gateway server
    api_key="your-gateway-key",
)
```

**TypeScript / JavaScript**

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8080/v1", // your Gateway server
  apiKey: "your-gateway-key",
});
```

### Anthropic SDK

The Anthropic SDK authenticates with `x-api-key`, which Gateway accepts
alongside `Authorization: Bearer`.

**Python**

```python
from anthropic import Anthropic

client = Anthropic(
    base_url="http://localhost:8080",  # your Gateway server (no /v1 suffix)
    api_key="your-gateway-key",
)
```

**TypeScript / JavaScript**

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "http://localhost:8080", // your Gateway server (no /v1 suffix)
  apiKey: "your-gateway-key",
});
```

## Supported LLM Providers

Gateway supports OpenAI, Anthropic, Cohere, Google Gemini, Vertex AI, DeepSeek,
Groq, Fireworks AI, Meta (Muse Spark), OpenRouter, Z.ai, xAI (Grok), Alibaba
Cloud Model Studio (Bailian), Kilo AI, MiniMax, Xiaomi MiMo, OpenCode Go, Azure
OpenAI, Oracle, Ollama, SGLang, vLLM, llm-d, Amazon Bedrock Runtime, Amazon
Bedrock Mantle, and all OpenAI-compatible providers. ElevenLabs is supported
for text-to-speech and speech-to-text.

See the [provider overview](./docs/providers/overview.mdx) for the full
per-provider feature matrix (chat, `/responses`, embeddings, files, batches,
passthrough), credentials, and configuration notes.

---

## Docker Compose

**Infrastructure only** (Redis, PostgreSQL, MongoDB, Adminer - no image build):

```bash
cp .env.template .env
# Add your API keys to .env
docker compose up -d
# or: make infra
```

**Full stack from source** (adds Gateway + Prometheus and builds the app image locally):

```bash
docker compose --profile app up -d
# or: make image
```

| Service         | URL                   |
| --------------- | --------------------- |
| Gateway API     | http://localhost:8080 |
| Adminer (DB UI) | http://localhost:8081 |
| Prometheus      | http://localhost:9090 |

### Building the Docker Image Locally

```bash
docker build -t gateway .
docker run --rm -p 8080:8080 --env-file .env gateway
```

---

## API Endpoints

Gateway exposes OpenAI-compatible and Anthropic-compatible APIs, provider-native
passthrough, and operations routes. See the [API endpoints
reference](./docs/advanced/api-endpoints.mdx) for the complete endpoint tables
and [Admin endpoints](./docs/advanced/admin-endpoints.mdx) for the admin REST API
and dashboard.

---

## Configuration

Gateway is configured through environment variables and an optional
`config.yaml`. Environment variables override YAML values. See the
[configuration reference](./docs/advanced/configuration.mdx),
[`.env.template`](./.env.template), and
[`config/config.example.yaml`](./config/config.example.yaml).

---

## Features

- [Caching](./docs/features/cache.mdx) - exact and semantic response caching
- [Cost tracking](./docs/features/cost-tracking.mdx) - per-request cost estimates and usage analytics
- [Budgets](./docs/features/budgets.mdx) - spending limits per user path, label, or key
- [Rate limits](./docs/features/rate-limits.mdx) - request, token, and concurrency limits
- [Virtual models](./docs/features/virtual-models.mdx) - stable aliases and load balancing across models
- [Failover](./docs/features/failover.mdx) - automatic fallback routing with [retries and circuit breakers](./docs/advanced/resilience.mdx)
- [Labelling](./docs/features/labelling.mdx) - request labels from headers or API keys
- [User paths](./docs/features/user-path.mdx) - hierarchical access, usage, and policy scopes
- [MCP gateway](./docs/features/mcp-gateway.mdx) - authenticated aggregation of MCP servers
- [Passthrough API](./docs/features/passthrough-api.mdx) - provider-native APIs with Gateway authentication and tracking
- [Guardrails](./docs/advanced/guardrails.mdx) - request and response policies
- [Provider key rotation](./docs/providers/key-rotation.mdx) - round-robin credential rotation
- [Observability](./docs/guides/prometheus-metrics.mdx) - Prometheus metrics, audit logs, and live request streaming

## Roadmap

See the [roadmap](./docs/about/roadmap.mdx) for current progress and planned work.

## Repositories

- **Gateway:** [DevKuAI/devku-gateway](https://github.com/DevKuAI/devku-gateway)
- **Original upstream:** [ENTERPILOT/GoModel](https://github.com/ENTERPILOT/GoModel)

## License

Gateway is available under the [MIT License](./LICENSE). See the
[license documentation](./docs/about/license.mdx) for details.
