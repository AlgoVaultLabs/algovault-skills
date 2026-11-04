# AlgoVault x Freqtrade — gate every entry on pre_trade_check

`AlgoVaultPreTradeGate` is a strategy mixin. Its `confirm_trade_entry` runs AlgoVault's `pre_trade_check` on the entry Freqtrade is about to place, and Freqtrade skips the entry when the check returns `WAIT` or cannot run.

## Install

Copy three files into `user_data/strategies/` (Freqtrade puts a strategy's own folder on the import path while it loads it):

```bash
cp examples/freqtrade/algovault_gate.py examples/_shared/algovault_pre_trade.py user_data/strategies/
cp examples/freqtrade/GatedStrategy.py user_data/strategies/   # optional: the sample strategy
```

No package to install: the helper is Python standard library only.

## Use

Put the mixin before `IStrategy`:

```python
from freqtrade.strategy import IStrategy
from algovault_gate import AlgoVaultPreTradeGate

class MyStrategy(AlgoVaultPreTradeGate, IStrategy):
    algovault_hold_hours = 8      # the check's hold window, in hours
    ...
```

Then run in dry-run first:

```bash
export ALGOVAULT_API_KEY=...      # optional: without a key the check uses the free allowance
freqtrade trade --dry-run --strategy GatedStrategy --config config.json
```

## What the check sees

| Check param | From |
|---|---|
| `coin` | the pair's base: `BTC/USDT:USDT` → `BTC`, `1000PEPE/USDT:USDT` → `PEPE` |
| `side` | Freqtrade's `side`: `long` or `short` |
| `sizeUsd` | `amount × rate`: the stake times the leverage, in the stake currency |
| `holdHours` | `algovault_hold_hours` (default 8) |
| `orderType` | the entry's order type: `market` or `limit` |

## What passes

- `GO` and `CAUTION` enter; the decision, the reason codes, the checked size and the cheapest venue are logged.
- `WAIT` skips the entry and logs the reason codes.
- A check that cannot run (a transport error, a refusal, a reply with no decision) skips the entry. Freqtrade would enter on an exception in this callback, so the mixin catches every error itself.
- Backtesting, hyperopt and every other mode outside live and dry-run enter with no call: a check describes the market now, not a past candle.
- Spot pairs (no `:<settle>` suffix) enter unchecked.

## Settings

| Attribute | Default | Meaning |
|---|---|---|
| `algovault_hold_hours` | `8` | Hold window sent as `holdHours` |
| `algovault_timeout` | `3.0` | Seconds per HTTP request; the check makes two |
| `algovault_api_key` | `None` | A key; `None` reads `ALGOVAULT_API_KEY` |

## Limits

- Freqtrade calls `confirm_trade_entry` for a new trade only. Position adjustments (`adjust_trade_position`) do not pass through it.
- Each checked entry waits on a network call, bounded by `algovault_timeout`.
- If your strategy defines its own `confirm_trade_entry`, start it with `if not super().confirm_trade_entry(pair, order_type, amount, rate, time_in_force, current_time, entry_tag, side, **kwargs): return False`, or the gate never runs.

Full walkthrough: [`docs/integrations/freqtrade.md`](../../docs/integrations/freqtrade.md).
