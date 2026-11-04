# AlgoVault × Freqtrade — Check Every Entry Before It Goes Out

AlgoVault's `pre_trade_check` reads one planned perp order (coin, side, size, hold time) against fees, funding, venue capacity, the market regime and your saved rules, and answers `GO`, `CAUTION` or `WAIT` with reason codes and the cheapest venue. This recipe runs it from Freqtrade's `confirm_trade_entry`, so a bot in live or dry-run mode skips an entry the check answers `WAIT`.

> **Provenance:** Freqtrade's `confirm_trade_entry` callback (<https://www.freqtrade.io/en/stable/strategy-callbacks/>); `freqtradebot.py` calls it once per new trade and enters when the callback raises, so the recipe catches every error itself. AlgoVault MCP endpoint: `https://api.algovault.com/mcp`.

## TL;DR (3-line hook)

- One mixin, one callback: `confirm_trade_entry` asks `pre_trade_check` about the entry Freqtrade is about to place, on its own size.
- `WAIT`, or a check that cannot run, skips the entry. `GO` and `CAUTION` enter, with the decision and reason codes logged.
- Backtests and hyperopt never call it: a check describes the market now, not a past candle.

## What you'll build (90s read)

A Freqtrade strategy that:

1. Generates its own entries (the sample uses a plain EMA cross).
2. Before each new trade, sends AlgoVault the pair's base coin, the side, the size (`amount × rate`), a hold window and the order type.
3. Enters on `GO` or `CAUTION`, and skips the entry on `WAIT` or when the check cannot run.

## Prerequisites (4 items)

1. **Freqtrade** with a futures configuration (pairs like `BTC/USDT:USDT`). Spot pairs pass unchecked.
2. **Python ≥ 3.10**. No extra package: the helper is standard library only.
3. **An AlgoVault API key** in `ALGOVAULT_API_KEY` (optional: without one the check uses the free allowance).
4. **Three files** from [`examples/freqtrade`](https://github.com/AlgoVaultLabs/algovault-skills/tree/main/examples/freqtrade) and [`examples/_shared`](https://github.com/AlgoVaultLabs/algovault-skills/tree/main/examples/_shared), copied into `user_data/strategies/`.

## Demo: gate a strategy's entries (≤80 lines)

```python
# examples/freqtrade/GatedStrategy.py (excerpt)
from freqtrade.strategy import IStrategy
from pandas import DataFrame

from algovault_gate import AlgoVaultPreTradeGate


class GatedStrategy(AlgoVaultPreTradeGate, IStrategy):
    INTERFACE_VERSION = 3

    timeframe = "1h"
    can_short = True
    minimal_roi = {"0": 0.04}
    stoploss = -0.02

    # pre_trade_check's hold window, in hours: sets the funding cost it weighs.
    algovault_hold_hours = 8

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[dataframe["cross_up"], "enter_long"] = 1
        dataframe.loc[dataframe["cross_down"], "enter_short"] = 1
        return dataframe
```

Run it:

```bash
cp examples/freqtrade/GatedStrategy.py examples/freqtrade/algovault_gate.py examples/_shared/algovault_pre_trade.py user_data/strategies/
freqtrade trade --dry-run --strategy GatedStrategy --config config.json
```

What the mixin logs (message text):

```
pre-trade gate: BTC long passed pre_trade_check: decision CAUTION, reason codes REGIME_AGAINST_SIDE, checked size <amount × rate> USD, cheapest venue <venue>.
pre-trade gate: pre_trade_check returned WAIT for ETH short (<codes>). Execution stopped.
BTC/USDT:USDT pre-trade gate: pre_trade_check could not run (<reason>), so the order is blocked.
```

## Walkthrough (line-by-line — neutral narration)

The mixin's `confirm_trade_entry` does three things in order:

1. **Decide whether to check.** Outside live and dry-run (`self.config["runmode"]`), and for spot pairs, it returns `True` with no call.
2. **Ask AlgoVault.** It sends `coin` (the pair's base, multiplier prefixes like `1000` removed), `side`, `sizeUsd = amount × rate` (Freqtrade computes `amount` as stake ÷ rate × leverage, so this is the position's notional in the stake currency), `holdHours` and `orderType`.
3. **Act on the answer.** `WAIT` returns `False` and Freqtrade skips the entry; `GO` and `CAUTION` return `True`. Any error (a timeout, a refusal, a reply with no decision) returns `False`: Freqtrade itself would enter on an exception. The strategy decides what to trade; the check decides only whether this entry goes out now.

## 3 Recipes

### Recipe 1 — A longer hold

The check weighs funding over `holdHours`. A strategy that holds for a day sets it:

```python
class SwingStrategy(AlgoVaultPreTradeGate, IStrategy):
    algovault_hold_hours = 24
```

### Recipe 2 — A strategy with its own `confirm_trade_entry`

Python calls the most derived method, so a strategy that defines `confirm_trade_entry` must call the gate first:

```python
def confirm_trade_entry(self, pair, order_type, amount, rate, time_in_force, current_time, entry_tag, side, **kwargs):
    if not super().confirm_trade_entry(pair, order_type, amount, rate, time_in_force, current_time, entry_tag, side, **kwargs):
        return False
    # your own checks
    return True
```

### Recipe 3 — Key and timeout per strategy

```python
class KeyedStrategy(AlgoVaultPreTradeGate, IStrategy):
    algovault_api_key = "..."   # None (the default) reads ALGOVAULT_API_KEY
    algovault_timeout = 5.0     # seconds per HTTP request; the check makes two
```

## ⚠️ Production setup (real-money)

Run in dry-run first. Before live trading:

- Freqtrade's docs advise against network requests in this callback. The check is one, so each checked entry waits on it, bounded by `algovault_timeout`.
- Freqtrade calls `confirm_trade_entry` for a new trade only. Position adjustments (`adjust_trade_position`) do not pass through it.
- Exchange API keys with only the permissions the bot needs (no withdrawals, IP-allowlisted), and your own risk controls: a per-trade stake cap, a daily loss limit, a kill switch.

See [`examples/freqtrade/README.md`](https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/freqtrade/README.md) for the settings table. **AlgoVault provides analytics; your strategy and your risk policy decide what (if anything) to execute.**

## Why AlgoVault?

- **The order, not just the market.** The check reads the entry you are about to place: its size against venue capacity, its funding over your hold, the regime against your side.
- **One answer to act on.** `GO`, `CAUTION` or `WAIT`, with machine-readable reason codes.
- **Fails closed.** A check that cannot run keeps the entry out.

## Install

```bash
cp examples/freqtrade/algovault_gate.py examples/_shared/algovault_pre_trade.py user_data/strategies/
```

The [skills pack](https://github.com/AlgoVaultLabs/algovault-skills) also carries the Claude Code pre-trade gate plugin and the LangChain middleware.

---

*Tutorial © AlgoVault Labs · MIT licensed · Provenance verified 2026-11-04*
