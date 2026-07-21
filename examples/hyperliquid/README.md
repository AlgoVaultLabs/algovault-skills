# `examples/hyperliquid/` — Hyperliquid testnet demo

Runnable equivalent of the Demo in [`docs/integrations/hyperliquid.md`](../../docs/integrations/hyperliquid.md).

## What it does

1. Fetches an AlgoVault composite verdict for ETH 1h via [`getAlgoVaultVerdict`](../_shared/algovault-helper.mjs).
2. Applies the agent's policy: `call === 'BUY' && confidence > 70`.
3. Resolves the asset index from Hyperliquid **testnet** metadata (`POST /info`), builds the exact `order` action the verdict implies, and **prints it**.

**This demo is keyless and never submits.** That is deliberate, for two verified reasons:

- Hyperliquid's testnet faucet requires **a prior mainnet deposit from the same address**, so a clean throwaway wallet cannot fund itself. A submitting demo would be unrunnable for most readers.
- Submission requires an EIP-712 "phantom agent" signature under a hardcoded `chainId: 1337` domain, and there is **no official JavaScript SDK**. Hand-rolling that signature in a tutorial is how broken signers get shipped.

Actual submission is documented in Recipe 3 of the tutorial, using the OFFICIAL Python SDK (`hyperliquid-python-sdk`, PyPI 0.24.0).

**Hard guards (every run):**

- `HYPERLIQUID_TESTNET=true` env var required — the demo throws immediately otherwise.
- `MAINNET_BLOCKED = true` constant in source.
- `SAMPLE_SIZE <= MAX_SIZE = 0.01` ETH — capped at module load.
- The base URL is asserted to contain `testnet`; the demo refuses to run against `api.hyperliquid.xyz`.
- No signing key is ever read, so **no order can be submitted by this script**.

## ⚠️ Eligibility

Hyperliquid's [Terms of Use](https://app.hyperliquid.xyz/terms) §1.6 (updated 2026-06-15) list the **United States** and **Ontario, Canada** among Restricted Persons prohibited from using the Interface, and §1.9 requires that you not disguise your location. Determine your own eligibility before proceeding.

## Run

```bash
HYPERLIQUID_TESTNET=true node examples/hyperliquid/demo.mjs
```

No account, no funds, no API wallet required.

## Real-money checklist (before you ever point this at mainnet)

- [ ] KYC complete and the service is available in your jurisdiction.
- [ ] Production API credentials scoped to **only** what the agent needs — no withdrawal permission, IP-allowlisted.
- [ ] Per-order size cap enforced in code, not just in config.
- [ ] Daily loss limit + a kill switch you can trigger without a deploy.
- [ ] Independent position monitoring (a separate watchdog, not the trading agent itself).
- [ ] The demo's hard guards replaced with deliberate, reviewed production guards.

**AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## See also

- Tutorial: [`docs/integrations/hyperliquid.md`](../../docs/integrations/hyperliquid.md)
- Shared MCP helper: [`examples/_shared/algovault-helper.mjs`](../_shared/algovault-helper.mjs)
- Live track record: <https://algovault.com/track-record>
