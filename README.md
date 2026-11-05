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

## Pre-trade gate (Claude Code)

A second, opt-in plugin in this marketplace. While it is enabled, Claude Code does not send an
opening perpetual or futures order through an exchange's MCP tools until `pre_trade_check` has
recently checked that coin and side, and it blocks the order when the check returns WAIT.

```bash
claude plugin marketplace add AlgoVaultLabs/algovault-skills
claude plugin install algovault-pre-trade-gate@algovault-skills
```

Requires Node.js 20+ and Claude Code 2.1.295+, the version that honours `onFailure: "block"`:
a gate that cannot run blocks the order instead of letting it through. The plugin holds no key
and never calls AlgoVault itself. It reads the result of the `pre_trade_check` your agent runs,
so connect the AlgoVault MCP server as usual.

- **Gated:** an opening order on a perpetual or futures contract. OKX `swap_place_order`,
  `futures_place_order`, `swap_batch_orders` (place), `futures_batch_orders`,
  `swap_place_algo_order`, `swap_place_move_stop_order`, `futures_place_algo_order` and
  `futures_place_move_stop_order`; Bybit `createOrder` and
  `batchCreateOrders` (linear and inverse); and a `place_order`, `create_order` or
  `open_position` tool whose input names a coin and a side. Each leg of a batch needs its own check.
- **Passes:** a check from this session for the same coin and side, at most 15 minutes old,
  that returned GO or CAUTION. The agent is shown the decision, its reason codes, the checked
  size and the cheapest venue. The gate matches coin and side, not size.
- **Blocked:** no recent check, a WAIT, or an order the gate cannot read. The agent sees why,
  for example `pre-trade gate: Missing check for BTC long. Run pre_trade_check first (or use
  reduce-only to close).`
- **Never gated:** closes (reduce-only, or a hedge-mode close), spot, options, cancels, amends,
  and every AlgoVault tool.

Options, in `/config` or with `claude plugin configure algovault-pre-trade-gate@algovault-skills`:
`max_age_minutes` (1 to 240, default 15), `on_wait` (`deny` or `ask`, default `deny`; `ask`
lets a person approve a WAIT), and `order_tools` (a regular expression over the full tool name,
such as `mcp__hyperliquid__(place_order|market_open)`, that replaces the built-in list).

Switch it off:

```bash
claude plugin disable algovault-pre-trade-gate@algovault-skills
```

## Pre-trade gate (Codex)

The same gate runs in the Codex CLI, through Codex's hooks. It needs Node.js 20+:

```bash
git clone https://github.com/AlgoVaultLabs/algovault-skills.git
node algovault-skills/plugins/pre-trade-gate/scripts/install.mjs codex
```

That adds the gate to `~/.codex/hooks.json` (`$CODEX_HOME/hooks.json` when `CODEX_HOME` is set),
for every project. Add `--project <dir>` to put it in that project's `.codex/hooks.json` instead;
Codex runs a project's hooks only once it trusts the project. Keep the clone where it is: the
hooks run the gate from it.

Codex runs a new hook only once you trust it. The next time it starts, it asks you to review the
gate's two hooks: trust them, or the gate does not run.

It gates, passes and blocks the same orders as in Claude Code, above, and watches only those
built-in order tools. `--max-age <minutes>` sets how old a check may be (1 to 240, default 15).
Codex cannot ask a person to approve a hook's decision, so a WAIT is always blocked.

If the gate itself crashes or times out, Codex lets the order through: no Codex setting makes a
failed hook block. The gate blocks an order on every error it can catch, and it never blocks an
AlgoVault tool.

Remove it (add the same `--project <dir>` if you installed it there):

```bash
node algovault-skills/plugins/pre-trade-gate/scripts/install.mjs codex --uninstall
```

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

### Framework integrations

Drop-in tutorials for the major Python agent frameworks. Each tutorial pairs
AlgoVault MCP with the framework's canonical MCP-adapter library — copy-pasteable
demo code, no AlgoVault SDK required. `python examples/<framework>/demo.py BTC 4h`
returns a real BUY/SELL/HOLD verdict from `api.algovault.com/mcp`.

<!-- BUILD:README_FRAMEWORK_INTEGRATIONS_TABLE -->
| # | Framework | Tutorial | Demo | Mirror |
|---|---|---|---|---|
| 01 | LangChain | [`docs/integrations/langchain.md`](docs/integrations/langchain.md) | [`examples/langchain/demo.py`](examples/langchain/demo.py) | [algovault.com/docs/integrations/langchain](https://algovault.com/docs/integrations/langchain) |
| 02 | LlamaIndex | [`docs/integrations/llamaindex.md`](docs/integrations/llamaindex.md) | [`examples/llamaindex/demo.py`](examples/llamaindex/demo.py) | [algovault.com/docs/integrations/llamaindex](https://algovault.com/docs/integrations/llamaindex) |
| 03 | Microsoft Agent Framework | [`docs/integrations/maf.md`](docs/integrations/maf.md) | [`examples/maf/demo.py`](examples/maf/demo.py) | [algovault.com/docs/integrations/maf](https://algovault.com/docs/integrations/maf) |
| 04 | CrewAI | [`docs/integrations/crewai.md`](docs/integrations/crewai.md) | [`examples/crewai/demo.py`](examples/crewai/demo.py) | [algovault.com/docs/integrations/crewai](https://algovault.com/docs/integrations/crewai) |
<!-- /BUILD:README_FRAMEWORK_INTEGRATIONS_TABLE -->

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
└── docs/                     # HOW_TO_ADD.md + integrations/{binance,okx,bybit,bitget}.md + SUBMIT_<EXCHANGE>.md templates
```

## Development

```bash
npm run preflight             # Verify env + repo + MCP reachable
npm run gen                   # Regenerate all SKILL.md files from manifest
npm test                      # Live smoke test against api.algovault.com
npm run test:unit             # Offline unit tests (helper + template-consistency canary)
```

### Submission generator

`scripts/generate_skill_submission.mjs` reads a `docs/SUBMIT_<EXCHANGE>.md`
template, fetches live track-record data from the AlgoVault API, and emits
ready-to-paste submission artifacts (`SKILL.md` for Skills-Hub PRs,
`PR_TITLE.txt`, `PR_BODY.md`, `SUMMARY.md` for every exchange):

```bash
node scripts/generate_skill_submission.mjs --exchange BINANCE
node scripts/generate_skill_submission.mjs --exchange BYBIT --output-dir /tmp/foo/
```

Templates use `<PLACEHOLDER>` tokens (`<PFE_WR>`, `<TOTAL_CALLS>`,
`<BATCH_COUNT>`, `<VERSION>`, etc.) so submission text never carries stale
hardcoded numbers. CI canary `tests/unit/submit-template-consistency.test.mjs`
fails the build if any template re-introduces a literal — keeps the templating
discipline locked in.

## Contributing

Skills are added via `skills/manifest.json` only — never hand-edit generated `SKILL.md` files.
Add a manifest entry, run `npm run gen`, commit both. PRs welcome.

## Also built by AlgoVault Labs

- **`@algovaultofficialbot`** — free public Telegram bot. Regime alerts + AlgoVault trade calls (BUY/SELL) pushed to your watchlist. Same composite-verdict signal stream these skills wrap. Source: [github.com/AlgoVaultLabs/algovault-bot](https://github.com/AlgoVaultLabs/algovault-bot).

## Built by [AlgoVault Labs](https://algovault.com)

Composable signal-interpretation tools for AI trading agents — MIT licensed.
