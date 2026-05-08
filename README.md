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

<!-- BUILD:README_INTEGRATIONS_TABLE -->
| # | Exchange | Tutorial | Demo | Mirror |
|---|---|---|---|---|
| 01 | Binance | [`docs/integrations/binance.md`](docs/integrations/binance.md) | [`examples/binance/demo.mjs`](examples/binance/demo.mjs) | [algovault.com/docs/integrations/binance](https://algovault.com/docs/integrations/binance) |
| 02 | OKX | [`docs/integrations/okx.md`](docs/integrations/okx.md) | [`examples/okx/demo.mjs`](examples/okx/demo.mjs) | [algovault.com/docs/integrations/okx](https://algovault.com/docs/integrations/okx) |
| 03 | Bybit | [`docs/integrations/bybit.md`](docs/integrations/bybit.md) | [`examples/bybit/demo.mjs`](examples/bybit/demo.mjs) | [algovault.com/docs/integrations/bybit](https://algovault.com/docs/integrations/bybit) |
| 04 | Bitget | [`docs/integrations/bitget.md`](docs/integrations/bitget.md) | [`examples/bitget/demo.mjs`](examples/bitget/demo.mjs) | [algovault.com/docs/integrations/bitget](https://algovault.com/docs/integrations/bitget) |
<!-- /BUILD:README_INTEGRATIONS_TABLE -->

Quick install + run any demo:

```bash
claude plugin install AlgoVaultLabs/algovault-skills
git clone https://github.com/AlgoVaultLabs/algovault-skills && cd algovault-skills && npm install
BINANCE_TESTNET=true node examples/binance/demo.mjs   # or OKX_DEMO=true / BYBIT_TESTNET=true / BITGET_DEMO=true
```

Distribution surface tracker: [`docs/INTEGRATIONS_DISTRIBUTION.md`](docs/INTEGRATIONS_DISTRIBUTION.md).

## The 20 Skills

<!-- SKILLS_TABLE -->
<!-- BUILD:README_SKILLS_TABLE -->
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
<!-- /BUILD:README_SKILLS_TABLE -->
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

## Also built by AlgoVault Labs

- **`@algovaultofficialbot`** — free public Telegram bot. Regime alerts + AlgoVault trade calls (BUY/SELL) pushed to your watchlist. Same composite-verdict signal stream these skills wrap. Source: [github.com/AlgoVaultLabs/algovault-bot](https://github.com/AlgoVaultLabs/algovault-bot).

## Built by [AlgoVault Labs](https://algovault.com)

Composable signal-interpretation tools for AI trading agents — MIT licensed.
