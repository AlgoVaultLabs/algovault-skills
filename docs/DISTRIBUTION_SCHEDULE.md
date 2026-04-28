# Distribution Schedule — DISTRIBUTION-CLOSEOUT-W1

4-day cadence to submit AlgoVault MCP × Exchange-Trade-Kit integration tutorials to the 4 exchange community surfaces. One/day deliberately to avoid spam-flag risk on a fresh GH account.

**Live snapshot at schedule generation (2026-04-28):**
- PFE Win Rate: **89.5%** (`overall.pfeWinRate=0.8947`)
- Trade calls: **61,428** (`totalCalls`)
- HOLD rate: **98.3%** (`hold_rate`)
- Merkle batches anchored: **18**

Re-fetch live numbers from `https://algovault.com/api/performance-public` immediately before each day's submission.

## Schedule

| Day | Date (UTC) | Exchange | Surface | Title | Status | URL after submit |
|-----|------------|----------|---------|-------|--------|------------------|
| 0 | 2026-04-28 | OKX | Discussion in `okx/agent-trade-kit` (Show & Tell) | Community Integration: AlgoVault MCP × OKX Agent Trade Kit (with runnable testnet demo) | **PENDING_PASTE_BACK** | _(filled when Mr.1 pastes back)_ |
| 1 | 2026-04-29 | Bybit | Issue in `bybit-exchange/trading-mcp` | Community Integration: AlgoVault MCP × Bybit Official Trading MCP (with runnable testnet demo) | scheduled | pending |
| 2 | 2026-04-30 | Bitget | Issue in `BitgetLimited/agent_hub` | Community Integration: AlgoVault MCP × Bitget Agent Hub (with GetClaw demo wrapper) | scheduled | pending |
| 3 | 2026-05-01 | Binance | PR-to-add-skill in `binance/binance-skills-hub` | Add AlgoVault MCP signal-interpretation skill | scheduled | pending |

## Day 0 — OKX (today, 2026-04-28)

**Target URL:** https://github.com/okx/agent-trade-kit/discussions/new?category=show-and-tell

**Title:** `Community Integration: AlgoVault MCP × OKX Agent Trade Kit (with runnable testnet demo)`

**Body:**

```markdown
Hey OKX Agent Trade Kit team — wanted to flag a community integration we just shipped.

**AlgoVault MCP** returns a composite trading verdict (signal/confidence/regime/factors) per call, fusing technical + funding + sentiment + cross-venue intelligence into one JSON. Pair it with the OKX Agent Trade Kit's `--demo` mode and an agent has the analytics brain + the OKX execution venue.

- **Tutorial:** https://algovault.com/docs/integrations/okx
- **Runnable demo:** https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/okx/demo.mjs (zero-key against `x-simulated-trading: 1`; with-keys via `npx -y @okx_ai/okx-trade-cli@latest --demo`)
- **Track record (live, on-chain Merkle-verified):** https://algovault.com/track-record — currently 89.5% PFE Win Rate across 61,428 trade calls, 18 Merkle batches anchored on Base L2.

The demo uses your `--demo` flag (verbatim from your `docs/cli-reference.md`) for the authenticated path + the equivalent `x-simulated-trading: 1` REST header for the zero-key path so it runs cleanly out of the box.

3 recipes covered: multi-asset regime scan + grid-bot trigger / funding-arb pair on options / risk-gated entry with confidence floor. All stay in OKX simulated trading; zero real-money risk in any code path.

Happy to evolve the tutorial based on whatever the OKX Agent Trade Kit team thinks is useful. MIT licensed. Built by AlgoVault Labs.
```

**After Mr.1 submits**, paste the resulting Discussion URL into chat. Code will:
1. Update this file's Day 0 row → ✅ + URL.
2. Update `docs/INTEGRATIONS_DISTRIBUTION.md` OKX `community_submission` cell.
3. Commit both edits.

## Day 1 — Bybit (2026-04-29, ~14:00 UTC)

**Target URL:** https://github.com/bybit-exchange/trading-mcp/issues/new

**Title:** `Community Integration: AlgoVault MCP × Bybit Official Trading MCP (with runnable testnet demo)`

**Body:**

```markdown
Hey Bybit Trading MCP team — wanted to flag a community integration.

**AlgoVault MCP** returns a composite trading verdict (signal/confidence/regime/factors) per call. Pair it with `bybit-official-trading-server@2.0.9` running with `BYBIT_TESTNET=true` and an agent has the analytics brain + Bybit Linear Perpetual execution.

- **Tutorial:** https://algovault.com/docs/integrations/bybit
- **Runnable demo:** https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/bybit/demo.mjs (testnet-only; uses `BYBIT_TESTNET=true` env from your README)
- **Track record (live, on-chain Merkle-verified):** https://algovault.com/track-record — currently 89.5% PFE Win Rate across 61,428 trade calls.

3 recipes covered: multi-timeframe consensus perp entry / volatility breakout with conditional orders / hedge-aware DCA. All stay on Bybit testnet; zero real-money risk.

Happy to evolve the tutorial. MIT licensed. Built by AlgoVault Labs.
```

## Day 2 — Bitget (2026-04-30, ~14:00 UTC)

**Target URL:** https://github.com/BitgetLimited/agent_hub/issues/new

**Title:** `Community Integration: AlgoVault MCP × Bitget Agent Hub (with GetClaw demo wrapper)`

**Body:**

```markdown
Hey Bitget Agent Hub team — wanted to flag a community integration.

**AlgoVault MCP** returns a composite trading verdict (signal/confidence/regime/factors) per call. Pair it with `bitget-mcp-server@1.1.0` running against a Bitget GetClaw demo account and an agent has the analytics brain + Bitget agent-native execution inside a dedicated AI account.

- **Tutorial:** https://algovault.com/docs/integrations/bitget
- **Runnable demo:** https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/bitget/demo.mjs (wrapper-enforced demo gating: `BITGET_DEMO=true` + `MAINNET_BLOCKED=true` + 0.0001 BTC order-size cap, since `bitget-mcp-server` has no built-in demo flag — gating happens at the wrapper layer + the GetClaw demo-account level)
- **Track record (live, on-chain Merkle-verified):** https://algovault.com/track-record — currently 89.5% PFE Win Rate across 61,428 trade calls.

3 recipes covered: NLP verdict via GetClaw / 5-Bitget-skills complement / agent-native rebalance. All stay on a dedicated GetClaw demo account; zero real-money risk.

Happy to evolve the tutorial. MIT licensed. Built by AlgoVault Labs.
```

## Day 3 — Binance (2026-05-01, ~14:00 UTC)

**Target URL:** https://github.com/binance/binance-skills-hub (open a PR adding `skills/algovault/SKILL.md`)

**Title:** `Add AlgoVault MCP signal-interpretation skill`

**Body:**

```markdown
Hey Binance Skills Hub team — submitting an AlgoVault skill PR per the Skills Hub contribution model.

**AlgoVault MCP** returns a composite trading verdict (signal/confidence/regime/factors) per call. The skill folder I'm adding (`skills/algovault/SKILL.md`) describes how to call AlgoVault from a Claude Code or Cowork session and pair the analytics with Binance Spot Testnet execution from the Skills Hub itself.

- **Tutorial:** https://algovault.com/docs/integrations/binance
- **Runnable demo:** https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/binance/demo.mjs (`BINANCE_TESTNET=true` + `MAINNET_BLOCKED=true` wrapper; runs against `https://testnet.binance.vision/api/v3/*`)
- **Track record (live, on-chain Merkle-verified):** https://algovault.com/track-record — currently 89.5% PFE Win Rate across 61,428 trade calls.

3 recipes covered: regime-gated DCA on BTC / confidence-filtered ETH swing / funding-arb cash-and-carry. Zero real-money risk in any code path (testnet-only).

Happy to evolve the SKILL.md based on whatever conventions the Skills Hub team prefers. MIT licensed. Built by AlgoVault Labs.
```

---

## Rendered numbers freshness policy

The "currently X PFE WR / Y trade calls" figures in each body are snapshots from the live `/api/performance-public` at schedule-generation time (2026-04-28 14:50 UTC). Re-fetch live values immediately before submitting each day if more than 24h has passed:

```bash
curl -fsS https://algovault.com/api/performance-public | jq '{pfe: .overall.pfeWinRate, calls: .overall.totalCalls, hold_rate}'
```

Substitute the live numbers into the body before pasting into the GitHub UI. (Or accept the snapshot — the absolute number changes daily but the order of magnitude doesn't.)
