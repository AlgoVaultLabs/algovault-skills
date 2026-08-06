# AlgoVault × Gate.io — Build Verifiable AI Trading Agents

> <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="batch_count">100</span>+ Merkle-verified on-chain batches.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-gateio)
> *Live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2. Pair it with Gate.io's futures testnet and your agent has both the analytics brain and the execution venue.

> **Provenance:** OFFICIAL [`gate-api`](https://github.com/gate/gateapi-python) — **7.2.100** on both [PyPI](https://pypi.org/project/gate-api/) and [npm](https://www.npmjs.com/package/gate-api), published 2026-06-25 from Gate's verified [`gate`](https://github.com/gate) organisation. Demo execution targets the Gate futures testnet at **`https://api-testnet.gateapi.io/api/v4`** (see the host note below) with `GATEIO_TESTNET=true` + `MAINNET_BLOCKED=true` wrapper guards. Verified 2026-07-21.

## ⚠️ Use this testnet host — the SDK's default no longer answers

This is the one thing to get right before writing any code.

Gate has moved its futures testnet to **`https://api-testnet.gateapi.io`**. The older host, `fx-api-testnet.gateio.ws`, still resolves and still terminates TLS but returns **HTTP 502 on every market-data read** — verified continuously across two days and two networks on 2026-07-21.

The catch: **`gate-api` 7.2.100 still ships the old host as its default.** Both the Python and Go SDKs list `fx-api-testnet.gateio.ws` in their host settings, and Gate has published no migration notice — so if you construct the client and accept its defaults, every testnet call fails with a 502 that looks like an outage rather than a misconfiguration.

Set the base URL explicitly:

```python
import gate_api
cfg = gate_api.Configuration(
    host="https://api-testnet.gateapi.io/api/v4",   # NOT the SDK default
    key=GATE_TESTNET_KEY, secret=GATE_TESTNET_SECRET,
)
```

Gate's own current tooling (`gate-cli`, `gate-mcp`) and ccxt both point at the new host, which is what this tutorial follows. Treat the host as a value to verify, not a constant — re-probe it before you rely on it in anything long-lived.

## TL;DR (3-line hook)

- One API call → composite verdict (signal, confidence, regime, factors). Not 26 raw indicators.
- Cross-venue intelligence across 12 exchanges. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim.

## What you'll build (90s read)

A runnable Node.js agent that:

1. Calls AlgoVault MCP for a composite verdict on a chosen asset + timeframe.
2. Reads the verdict's `call`, `confidence`, `regime`, and `reasoning` fields.
3. Converts a coin-denominated position size into Gate **contracts** and builds the order the verdict implies, running against Gate's futures **testnet**.

The whole loop runs against Gate's testnet — **zero real-money risk in any code path**.

## Prerequisites (4 items)

1. **Node.js ≥ 22** (`node --version` to check).
2. **AlgoVault skills plugin** installed:
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **Nothing else for the demo.** It is keyless — Gate's testnet market-data endpoints need no credentials.
4. **For actual order submission only**, testnet API credentials (minted separately from your mainnet keys, in the testnet console) plus the official SDK:
   ```bash
   pip install gate-api        # or: npm install gate-api
   ```

## Demo: Contracts-aware sizing on BTC (≤80 lines)

```javascript
// examples/gateio/demo.mjs (excerpt — see file for full source)
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

const MAINNET_BLOCKED = true;
const GATE_TESTNET_BASE = 'https://api-testnet.gateapi.io/api/v4';

if (process.env.GATEIO_TESTNET !== 'true') {
  throw new Error('GATEIO_TESTNET=true required — demo refuses to run against mainnet.');
}

// Gate sizes futures in CONTRACTS, not coins. Read the multiplier, don't assume it.
const c = await fetch(`${GATE_TESTNET_BASE}/futures/usdt/contracts/BTC_USDT`).then(r => r.json());
const contracts = Math.max(1, Math.round(TARGET_BTC / Number(c.quanto_multiplier)));

const verdict = await getAlgoVaultVerdict({ coin: 'BTC', timeframe: '1h' });

if (verdict.call === 'BUY' && verdict.confidence > 70) {
  const order = { contract: 'BTC_USDT', size: contracts, price: '0', tif: 'ioc' };
  console.log(JSON.stringify(order, null, 2)); // printed, NOT signed or sent
}
```

Run it:

```bash
GATEIO_TESTNET=true node examples/gateio/demo.mjs
```

Expected output (last 3 lines):

```
[gate testnet | BTC_USDT quanto_multiplier=0.0001 → 0.001 BTC = 10 contracts]
[gate] would submit: POST https://api-testnet.gateapi.io/api/v4/futures/usdt/orders
[gate] order printed above — NOT signed, NOT sent. Demo complete.
```

## Walkthrough (line-by-line — neutral narration)

The script does three things in order:

1. **Resolve contract sizing.** It reads `quanto_multiplier` from the single-contract endpoint and converts the target coin quantity into an integer contract count. This step comes *first* because it is the one most likely to be silently wrong — see Recipe 1.

2. **Fetch the AlgoVault verdict.** The helper opens an MCP session against `https://api.algovault.com/mcp`, calls `get_trade_call` with `{coin, timeframe}`, and returns the parsed `call` / `confidence` / `regime` / `reasoning` payload. Free tier covers 100 calls/month — plenty for development.

3. **Apply the agent's policy and build the order.** When the verdict satisfies a pre-configured policy (e.g. *the agent's policy fires when `confidence > 70` AND `call === 'BUY'`*), the script assembles the Gate order body and prints it. The policy lives entirely in your code — AlgoVault returns the analytics; the agent decides. The script aborts immediately if `GATEIO_TESTNET` is not set, and refuses to run if the base URL is not the testnet host.

## 3 Recipes

### Recipe 1 — Size in contracts, never in coins

This is the single most common way to get a Gate futures order wrong. `size` is a **contract count**, not a coin quantity, and the conversion factor is per-contract: `quanto_multiplier` for `BTC_USDT` is `0.0001`, so 0.001 BTC is **10 contracts**, not `0.001`. Passing a coin amount straight through either rounds to zero and gets rejected, or — if the multiplier is small — silently opens a position orders of magnitude off your intent.

Always read the multiplier from `GET /futures/{settle}/contracts/{contract}` rather than hardcoding it; it differs per contract and Gate can change it.

### Recipe 2 — Direction is the sign of `size`

Gate does not take a `side` field on futures orders. A **positive** `size` is long, a **negative** `size` is short. To close a position, send `size: 0` with `close: true` (single-position mode), or `size: 0` with `auto_size` and `reduce_only: true` in dual/hedge mode. In hedge mode with `reduce_only`, the polarity inverts meaning — a positive size reduces a short. Encode this once in a helper and unit-test it; it is easy to invert under pressure.

### Recipe 3 — Get the signature right the first time

Gate's futures API signs with **HMAC-SHA512**, not SHA256, and the payload is five newline-joined fields:

```
METHOD \n URL_PATH \n QUERY_STRING \n SHA512_HEX(body) \n TIMESTAMP
```

Three details cause most failures. The **body is hashed even when empty** — omit that line and every signature is wrong. The `Timestamp` header is in **seconds**, while the optional `x-gate-exptime` header is in **milliseconds** — mixed units inside one API. And the headers are `KEY` / `Timestamp` / `SIGN`, not the `X-`-prefixed names other venues use.

## ⚠️ Production setup (real-money)

The demo above runs on testnet only. Real-money setup requires:

- KYC completion on Gate.io, and confirming the service is available in your jurisdiction.
- Production API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted). Testnet and mainnet credentials are separate — testnet keys do not work against mainnet.
- Switching the base URL to `https://api.gateio.ws/api/v4`, deliberately and in one place.
- Risk controls: per-order size cap, daily loss limit, kill switch.
- Position monitoring: a separate agent or watchdog that tracks open positions independently.
- Awareness that an unfilled order withdrawn more than 10 minutes ago becomes unfetchable — the API reports it does not exist, so don't build a poller that assumes old order ids stay queryable.

See `examples/gateio/README.md` for the full real-money checklist. **AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Why AlgoVault?

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 12 exchanges — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="batch_count">100</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-gateio-footer)

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial © AlgoVault Labs · MIT licensed · Provenance verified 2026-07-21 · `gate-api` 7.2.100 OFFICIAL (`github.com/gate/gateapi-python`); its default testnet host is stale — set the base URL explicitly*
