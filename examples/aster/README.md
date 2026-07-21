# `examples/aster/` — Aster futures testnet demo

Runnable equivalent of the Demo in [`docs/integrations/aster.md`](../../docs/integrations/aster.md).

## What it does

1. Probes the Aster **testnet** for reachability, clock drift, and symbol listing (all keyless).
2. Fetches an AlgoVault composite verdict for BTC 1h via [`getAlgoVaultVerdict`](../_shared/algovault-helper.mjs).
3. Applies the agent's policy: `call === 'BUY' && confidence > 70`.
4. Builds the exact **V3** order request the verdict implies and **prints it**.

**This demo is keyless and never submits.** Aster closed **V1 API-key creation on 2026-03-25**, so a new reader cannot obtain the simple HMAC credentials at all; V3 is the only path forward, and it authenticates with an EIP-712 wallet signature requiring a funded testnet wallet plus a separately minted API wallet.

**Hard guards (every run):**

- `ASTER_TESTNET=true` env var required — the demo throws immediately otherwise.
- `MAINNET_BLOCKED = true` constant in source.
- `SAMPLE_QTY <= MAX_QTY = 0.001` BTC — capped at module load.
- The base URL is asserted to contain `-testnet.`; the demo refuses to run against `fapi.asterdex.com`.
- No signing key is ever read, so **no order can be submitted by this script**.

## Gotchas the demo surfaces for you

- The V3 `nonce` is in **microseconds** and must be within ±10s of server time — the demo prints your actual clock drift and warns above 10s.
- The EIP-712 `chainId` is **714 on testnet** and 1666 on mainnet. A copy-pasted mainnet signer fails silently against testnet.
- Aster publishes **nothing on npm or PyPI**. Its official Python connector installs from git only:
  ```bash
  pip install git+https://github.com/asterdex/aster-connector-python.git
  ```
  The README's `pip install aster-connector-python` returns a PyPI 404.
- The canonical domain is **asterdex.com** — `aster.exchange` does not resolve.

## Run

```bash
ASTER_TESTNET=true node examples/aster/demo.mjs
```

For actual submission, mint an API wallet at <https://www.asterdex-testnet.com/en/api-wallet> (`Pro API` tab) and fund it from the [faucet](https://www.asterdex-testnet.com/en/faucet) — 1,000 test USDT + 1,000 test ASTER, once per day.

## Real-money checklist (before you ever point this at mainnet)

- [ ] KYC complete and the service is available in your jurisdiction.
- [ ] Production API credentials scoped to **only** what the agent needs — no withdrawal permission, IP-allowlisted.
- [ ] Per-order size cap enforced in code, not just in config.
- [ ] Daily loss limit + a kill switch you can trigger without a deploy.
- [ ] Independent position monitoring (a separate watchdog, not the trading agent itself).
- [ ] The demo's hard guards replaced with deliberate, reviewed production guards.

**AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## See also

- Tutorial: [`docs/integrations/aster.md`](../../docs/integrations/aster.md)
- Shared MCP helper: [`examples/_shared/algovault-helper.mjs`](../_shared/algovault-helper.mjs)
- Live track record: <https://algovault.com/track-record>
