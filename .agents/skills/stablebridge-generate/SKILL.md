---
name: stablebridge-generate
description: Generate Stability AI images with stablebridge CLI or MCP. Use when the user invokes /stablebridge-generate or asks to generate images only.
disable-model-invocation: true
---

# stablebridge Generate

**Slash:** `/stablebridge-generate` — generate images only (no insert). API key never enters chat.

Install: `npx skills add mastercoder26/stablebridge --skill stablebridge-generate -y`

---

## Prerequisites

```bash
npx @astablebridge/cli status --format json
```

If not configured, run `/stablebridge-setup` or hand off `npx @astablebridge/cli onboard` only.

---

## Generate via CLI

```bash
npx @astablebridge/cli generate \
  --prompt "minimal flat app icon, blue gradient" \
  --name app-icon \
  --format json
```

Use `--model`, `--format-image`, `--aspect-ratio` when overrides are needed. Defaults come from onboard preferences.

---

## Generate via MCP

When MCP is configured (`stablebridge` server in `.cursor/mcp.json`):

- Tool: `stablebridge_generate_image`
- Pass prompt, optional name/model/format/aspect ratio
- Always confirm `configured: true` via `stablebridge_check_status` first if unsure

---

## Prompting

```text
{subject}, {style}, {lighting/composition}, {color constraints}, high quality, production-ready
Avoid: watermark, logo, text artifacts, low detail, noise, distortion
```

Respect `autonomyMode` and `creditBudgetFloor` from status. On `budgetExceeded`, stop and report.

---

## Security

- Never ask for API keys in chat
- Use masked key hints from CLI/MCP output only

See [reference.md](../reference.md) for path conventions.
