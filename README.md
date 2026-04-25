# AlgoVault Skills

**20 Anthropic Agent Skills over the [AlgoVault MCP server](https://api.algovault.com/mcp).**

Each Skill is a single-prompt wrapper over 1–3 calls to AlgoVault's signal-interpretation API
(`get_market_regime`, `get_trade_signal`, `scan_funding_arb`). Install once, invoke from any
Claude Code or Cowork session, and we surface the composite verdict — your agent decides execution.

> AlgoVault provides the thesis; your agent decides execution.

## Quick start

```bash
# In Claude Code
claude plugin install AlgoVaultLabs/algovault-skills

# In Cowork — discover via the marketplace, click "install"
```

Live track record (PFE Win Rate + cumulative call count, updated continuously):
**https://algovault.com/track-record**

## Integrations

End-to-end tutorials pairing AlgoVault's analytics with each major exchange's
agent execution kit. AlgoVault returns the verdict; the agent and its risk
policy decide what (if anything) to execute. **All demos run on testnet/demo
mode — zero real-money risk.**

| # | Exchange | Tutorial | Demo |
|---|---|---|---|
| 01 | Binance | [coming soon — INTEGRATIONS-W1 C2](docs/integrations/binance.md) | [coming soon](examples/binance/demo.mjs) |
| 02 | OKX | [coming soon — INTEGRATIONS-W1 C3](docs/integrations/okx.md) | [coming soon](examples/okx/demo.mjs) |
| 03 | Bybit | [coming soon — INTEGRATIONS-W1 C4](docs/integrations/bybit.md) | [coming soon](examples/bybit/demo.mjs) |
| 04 | Bitget | [coming soon — INTEGRATIONS-W1 C5](docs/integrations/bitget.md) | [coming soon](examples/bitget/demo.mjs) |

Distribution surface tracker: [`docs/INTEGRATIONS_DISTRIBUTION.md`](docs/INTEGRATIONS_DISTRIBUTION.md).

## The 20 Skills

<!-- SKILLS_TABLE -->
| # | Slug | Name | Difficulty | Tools |
|---|---|---|---|---|
| 01 | [`quick-btc-check`](skills/quick-btc-check/SKILL.md) | Quick BTC Check | Beginner | `get_trade_signal` |
| 02 | [`portfolio-scanner`](skills/portfolio-scanner/SKILL.md) | Portfolio Scanner | Intermediate | `get_trade_signal` |
| 03 | [`regime-aware-trading`](skills/regime-aware-trading/SKILL.md) | Regime-Aware Trading | Intermediate | `get_market_regime`, `get_trade_signal` |
| 04 | [`funding-arb-monitor`](skills/funding-arb-monitor/SKILL.md) | Funding Arb Monitor | Intermediate | `scan_funding_arb` |
| 05 | [`full-3-tool-pipeline`](skills/full-3-tool-pipeline/SKILL.md) | Full 3-Tool Pipeline | Advanced | `get_market_regime`, `get_trade_signal`, `scan_funding_arb` |
| 06 | [`multi-timeframe-confirmation`](skills/multi-timeframe-confirmation/SKILL.md) | Multi-Timeframe Confirmation | Advanced | `get_trade_signal` |
| 07 | [`tradfi-rotation`](skills/tradfi-rotation/SKILL.md) | TradFi Rotation | Advanced | `get_market_regime`, `get_trade_signal` |
| 08 | [`risk-gated-entry`](skills/risk-gated-entry/SKILL.md) | Risk-Gated Entry | Advanced | `get_market_regime`, `get_trade_signal` |
| 09 | [`funding-sentiment-dashboard`](skills/funding-sentiment-dashboard/SKILL.md) | Funding Sentiment Dashboard | Advanced | `get_market_regime` |
| 10 | [`contrarian-meme-scanner`](skills/contrarian-meme-scanner/SKILL.md) | Contrarian Meme Scanner | Advanced | `get_market_regime`, `get_trade_signal` |
| 11 | [`divergence-detector`](skills/divergence-detector/SKILL.md) | Divergence Detector | Advanced | `get_market_regime`, `get_trade_signal` |
| 12 | [`hourly-digest-bot`](skills/hourly-digest-bot/SKILL.md) | Hourly Digest Bot | Advanced | `get_trade_signal`, `get_market_regime` |
| 13 | [`hedging-advisor`](skills/hedging-advisor/SKILL.md) | Hedging Advisor | Advanced | `get_market_regime`, `get_trade_signal`, `scan_funding_arb` |
| 14 | [`volatility-breakout-watch`](skills/volatility-breakout-watch/SKILL.md) | Volatility Breakout Watch | Advanced | `get_market_regime`, `get_trade_signal` |
| 15 | [`cross-asset-correlation`](skills/cross-asset-correlation/SKILL.md) | Cross-Asset Correlation | Advanced | `get_trade_signal` |
| 16 | [`funding-cash-and-carry`](skills/funding-cash-and-carry/SKILL.md) | Funding Cash-and-Carry | Advanced | `scan_funding_arb`, `get_trade_signal` |
| 17 | [`weekend-vs-weekday-patterns`](skills/weekend-vs-weekday-patterns/SKILL.md) | Weekend vs Weekday Patterns | Research | `get_trade_signal`, `get_market_regime` |
| 18 | [`agent-portfolio-rebalance`](skills/agent-portfolio-rebalance/SKILL.md) | Agent Portfolio Rebalance | Advanced | `get_market_regime` |
| 19 | [`smart-dca-bot`](skills/smart-dca-bot/SKILL.md) | Smart DCA Bot | Advanced | `get_trade_signal` |
| 20 | [`multi-agent-war-room`](skills/multi-agent-war-room/SKILL.md) | Multi-Agent War Room | Expert | `get_market_regime`, `get_trade_signal`, `scan_funding_arb` |
<!-- /SKILLS_TABLE -->

## How attribution works

Every Skill invocation sends `X-AlgoVault-Skill-Slug: <slug>` to the MCP server. We aggregate
these in an admin-only counter inside `/dashboard` on `api.algovault.com` (per-Skill funnel
data is competitive intel — moved internal 2026-04-24). The public moat layer remains the
aggregate track record at <https://algovault.com/track-record> (Merkle-verified PFE WR +
signal/batch counts).

## Repo layout

```
algovault-skills/
├── .claude-plugin/
│   ├── plugin.json           # Plugin manifest (mcpServers, version, etc.)
│   └── marketplace.json      # Marketplace entry
├── skills/
│   ├── _template/            # SKILL.md.tmpl — generator template
│   ├── manifest.json         # Single source of truth: 20 Skill definitions
│   ├── manifest.schema.json  # JSON Schema v7 for manifest validation
│   └── <slug>/SKILL.md       # GENERATED — never hand-edit
├── scripts/
│   ├── gen-skill.mjs         # Reads manifest, emits SKILL.md per entry
│   └── skills_preflight.sh   # Pre-build environment check
├── tests/smoke/              # Live invocation tests against api.algovault.com
└── docs/MARKETPLACES.md      # Distribution status per marketplace
```

## Development

```bash
npm run preflight             # Verify env + repo + MCP reachable
npm run gen                   # Regenerate all SKILL.md files from manifest
npm test                      # Live smoke test against api.algovault.com
```

## Contributing

Skills are added via `skills/manifest.json` only — never hand-edit generated `SKILL.md` files.
Add a manifest entry, run `npm run gen`, commit both. PRs welcome.

## Built by [AlgoVault Labs](https://algovault.com)

Composable signal-interpretation tools for AI trading agents — MIT licensed.
