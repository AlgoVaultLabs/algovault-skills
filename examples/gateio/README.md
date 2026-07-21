# `examples/gateio/` — Gate.io futures testnet demo

Runnable equivalent of the Demo in [`docs/integrations/gateio.md`](../../docs/integrations/gateio.md).

## ⚠️ Use `api-testnet.gateapi.io` — the SDK default is dead

Gate moved its futures testnet to **`https://api-testnet.gateapi.io/api/v4`**. The older host
`fx-api-testnet.gateio.ws` still resolves and still terminates TLS, but returns **HTTP 502 on every
market-data read** (verified continuously across two days and two networks, 2026-07-21).

**`gate-api` 7.2.100 still ships that dead host as its default** — both the Python and Go SDKs list
it in their host settings, and Gate published no migration notice. Accept the SDK defaults and every
testnet call fails with a 502 that reads like an outage rather than a misconfiguration.

Gate's own current tooling (`gate-cli`, `gate-mcp`) and ccxt both point at the new host. This demo
follows that, and **refuses to run** if pointed at either the mainnet host or the drained legacy one.

## What it does

1. Reads `quanto_multiplier` from the testnet and converts a coin target into an integer **contract**
   count — the step most likely to be silently wrong (see below).
2. Fetches an AlgoVault composite verdict for BTC 1h via [`getAlgoVaultVerdict`](../_shared/algovault-helper.mjs).
3. Applies the agent's policy: `call === 'BUY' && confidence > 70`.
4. Builds the exact Gate order body the verdict implies and **prints it**.

**This demo is keyless and never submits.** Submission needs testnet credentials minted separately
from mainnet keys plus a correct HMAC-SHA512 signature over a 5-line payload; that is documented in
Recipe 3 of the tutorial rather than hand-rolled here.

**Hard guards (every run):**

- `GATEIO_TESTNET=true` env var required — the demo throws immediately otherwise.
- `MAINNET_BLOCKED = true` constant in source.
- `TARGET_BTC <= MAX_BTC = 0.001` — capped at module load.
- The base URL is asserted to be the `api-testnet.` host, and is explicitly rejected if it is either
  `api.gateio.ws` (mainnet) **or** `fx-api-testnet.gateio.ws` (the drained legacy host).
- No credentials are ever read, so **no order can be submitted by this script**.

## Gotchas the demo surfaces for you

- **`size` is a CONTRACT COUNT, not a coin quantity.** `quanto_multiplier` for `BTC_USDT` is
  `0.0001`, so 0.001 BTC is **10 contracts**. Pass a coin amount straight through and you either
  round to a rejected zero or open a position orders of magnitude off your intent. Read the
  multiplier per contract — never hardcode it.
- **Direction is the SIGN of `size`.** Gate futures orders carry no `side` field: positive is long,
  negative is short. Close with `size: 0` + `close: true`; in dual/hedge mode with `reduce_only`,
  the polarity inverts meaning.
- **Signing is HMAC-SHA512** over `METHOD\nPATH\nQUERY\nSHA512_HEX(body)\nTIMESTAMP`, and the **body
  is hashed even when empty**. Headers are `KEY` / `Timestamp` / `SIGN`.
- **Mixed time units in one API:** `Timestamp` is in **seconds**, `x-gate-exptime` is in
  **milliseconds**.
- **Testnet and mainnet credentials are separate** — testnet keys do not authenticate against mainnet.
- **Cite the live `gate` org, not the archived `gateio` account.** Six repos were archived on
  2026-07-16 and star counts now mislead badly (archived Python SDK 345★ vs live 23★).

## Run

```bash
GATEIO_TESTNET=true node examples/gateio/demo.mjs
```

No account, no funds, no credentials required.

## Real-money checklist (before you ever point this at mainnet)

- [ ] KYC complete and the service is available in your jurisdiction.
- [ ] Production API credentials scoped to **only** what the agent needs — no withdrawal permission, IP-allowlisted.
- [ ] Base URL switched to `https://api.gateio.ws/api/v4` deliberately, in exactly one place.
- [ ] Per-order size cap enforced in code, not just in config.
- [ ] Daily loss limit + a kill switch you can trigger without a deploy.
- [ ] Independent position monitoring (a separate watchdog, not the trading agent itself).
- [ ] The demo's hard guards replaced with deliberate, reviewed production guards.

**AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## See also

- Tutorial: [`docs/integrations/gateio.md`](../../docs/integrations/gateio.md)
- Shared MCP helper: [`examples/_shared/algovault-helper.mjs`](../_shared/algovault-helper.mjs)
- Live track record: <https://algovault.com/track-record>
