<!--
  AlgoVault × {{exchange_name}} — Integration tutorial template
  ============================================================
  This is the canonical structure used by every per-exchange tutorial in
  docs/integrations/<exchange>.md. C2-C5 of INTEGRATIONS-W1 fill in the
  {{double-brace}} placeholders and the per-recipe content. C6 mirrors the
  rendered output to algovault.com/docs/integrations/<exchange>.

  Cross-Cutting Law #3 (per spec): hero/footer = MOAT + track record;
  code-example narration = neutral observational ("the agent reads the
  verdict, applies its own risk policy, and decides"). Internal slogans
  stay internal — never appear in the rendered tutorial.

  Track record numbers are LIVE-verified at template-write time
  (snapshot 2026-04-25; see /api/performance-public for current values).
-->

# AlgoVault × {{exchange_name}} — Build Verifiable AI Trading Agents

> **89.5% PFE Win Rate · 54,629+ calls · 15+ Merkle-verified on-chain batches.**
> Don't trust — [verify the track record →]({{utm_url_hero}})
> *Snapshot taken 2026-04-25 — current numbers live at https://algovault.com/track-record*

AlgoVault MCP gives your agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2. Pair it with the {{exchange_name}} {{exchange_kit_name}} and your agent has both the analytics brain and the execution venue.

> **Provenance:** {{provenance_line}}

## TL;DR (3-line hook — MOAT-led)

- One API call → composite verdict (signal, confidence, regime, factors). Not 26 raw indicators.
- Cross-venue intelligence across 5 exchanges. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim.

## What you'll build (90s read)

A runnable Node.js agent that:

1. Calls AlgoVault MCP for a composite verdict on a chosen asset + timeframe.
2. Reads the verdict's `signal`, `confidence`, `regime`, and `factors` fields.
3. Hands the verdict to {{exchange_name}}'s {{exchange_kit_name}}, which executes a small order in **{{demo_mode_label}}** when the agent's pre-configured policy fires.

The whole loop runs against {{exchange_name}}'s {{demo_environment}} — **zero real-money risk in any code path**.

## Prerequisites (4 items)

1. **Node.js ≥ 22** (`node --version` to check)
2. **AlgoVault skills plugin** installed:
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **{{exchange_name}} {{demo_account_label}}** (free signup at {{demo_signup_url}}). API key + secret from your {{demo_account_label}}'s API console.
4. **`{{exchange_package_install}}`** — see the per-exchange [README]({{exchange_readme_url}}) for the install command.

## Demo: {{demo_recipe_1_title}} (≤80 lines)

```javascript
// examples/{{exchange_slug}}/demo.mjs (excerpt)
{{demo_excerpt}}
```

Run it:

```bash
{{demo_run_command}}
```

Expected output (last 3 lines):

```
{{demo_expected_output}}
```

## Walkthrough (line-by-line — neutral narration)

The script does three things in order:

1. **Fetch the AlgoVault verdict.** The helper opens an MCP session against `https://api.algovault.com/mcp`, calls `get_trade_signal` with `{coin, timeframe}`, and returns the parsed `signal` / `confidence` / `regime` / `factors` payload. Free tier covers up to 20 calls/day per IP — plenty for development.

2. **Apply the agent's policy.** When the verdict satisfies a pre-configured policy (e.g. *the agent's policy fires when `confidence > 70` AND `signal === 'BUY'`*), the script proceeds to the execution branch. The policy lives entirely in your code — AlgoVault returns the analytics; the agent decides.

3. **Hand the order to {{exchange_name}}.** The {{exchange_kit_name}} client receives a small {{demo_order_size}} order in {{demo_mode_label}}, prints the response, and exits 0. The script aborts immediately if the {{demo_environment}} environment variable is not set — a hard guard against accidentally running against mainnet.

## 3 Recipes

### Recipe 1 — {{recipe_1_title}}

{{recipe_1_body}}

### Recipe 2 — {{recipe_2_title}}

{{recipe_2_body}}

### Recipe 3 — {{recipe_3_title}}

{{recipe_3_body}}

## ⚠️ Production setup (real-money)

The demo above runs on {{demo_environment}} only. Real-money setup requires:

- KYC completion on {{exchange_name}}.
- Production API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted).
- Risk controls: per-order size cap, daily loss limit, kill switch.
- Position monitoring: a separate agent or watchdog that tracks open positions independently.

See `examples/{{exchange_slug}}/README.md` for the full real-money checklist. **AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Why AlgoVault? (closing — MOAT recap)

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 5 exchanges — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- **89.5% PFE Win Rate · 54,629+ calls · 15+ on-chain batches** → [view live track record]({{utm_url_footer}})

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial template © AlgoVault Labs · MIT licensed · Provenance verified {{verified_date}}*
