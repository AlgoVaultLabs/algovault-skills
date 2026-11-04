"""Gate Freqtrade entries on AlgoVault's pre_trade_check.

    from freqtrade.strategy import IStrategy
    from algovault_gate import AlgoVaultPreTradeGate

    class MyStrategy(AlgoVaultPreTradeGate, IStrategy):   # the gate before IStrategy
        algovault_hold_hours = 8
        ...

confirm_trade_entry runs pre_trade_check on the entry Freqtrade is about to place: the
pair's base coin, its side, sizeUsd = amount x rate (the stake times the leverage, in
the stake currency), holdHours = algovault_hold_hours and orderType = the entry's order
type. WAIT, or a check that cannot run, returns False and Freqtrade skips the entry. GO
and CAUTION return True, with the decision and reason codes logged.

Outside live and dry-run (backtest, hyperopt, ...) it returns True with no call: a check
describes the market now, not a past candle. Spot pairs (no ":<settle>" suffix) pass
unchecked: the check reads perpetual orders.

Freqtrade wraps this callback in strategy_safe_wrapper(..., default_retval=True), so an
exception would ENTER the trade. The mixin therefore catches every error itself and
returns False.

No Freqtrade import. Copy this file and examples/_shared/algovault_pre_trade.py next to
your strategy in user_data/strategies/.
"""

from __future__ import annotations

import logging
import re
import sys
from pathlib import Path
from typing import Any

try:
    import algovault_pre_trade
except ImportError:  # run from this repo: the helper lives in examples/_shared
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "_shared"))
    import algovault_pre_trade

logger = logging.getLogger(__name__)

TRADE_MODES = ("live", "dry_run")

# Venues list some coins in multiples: 1000PEPE on Binance and Bybit, kPEPE on Hyperliquid.
_HL_THOUSANDS = re.compile(r"^k(?=[A-Z])")
_MULTIPLIER = re.compile(r"^(?:1000000|100000|10000|1000)(?=[A-Z])")


def base_coin(pair: str) -> str:
    """The coin a pair trades: BTC/USDT:USDT -> BTC, 1000PEPE/USDT:USDT -> PEPE."""
    base = _HL_THOUSANDS.sub("", pair.split("/", 1)[0].strip()).upper()
    base = _MULTIPLIER.sub("", base)
    if not re.fullmatch(r"[A-Z0-9]+", base):
        raise ValueError(f"no base coin in pair {pair!r}")
    return base


class AlgoVaultPreTradeGate:
    """Freqtrade strategy mixin: pre_trade_check before each new trade's entry."""

    algovault_hold_hours: float = 8
    algovault_timeout: float = 3.0  # seconds, per request; the check makes two
    algovault_api_key: str | None = None  # None: ALGOVAULT_API_KEY from the environment

    def confirm_trade_entry(
        self,
        pair: str,
        order_type: str,
        amount: float,
        rate: float,
        time_in_force: str,
        current_time: Any,
        entry_tag: str | None,
        side: str,
        **kwargs: Any,
    ) -> bool:
        if not self._algovault_allows(pair, order_type, amount, rate, side):
            return False
        parent = getattr(super(), "confirm_trade_entry", None)
        if parent is None:
            return True
        return parent(pair, order_type, amount, rate, time_in_force, current_time, entry_tag, side, **kwargs)

    def _algovault_allows(self, pair: str, order_type: str, amount: float, rate: float, side: str) -> bool:
        try:
            runmode = self.config["runmode"]
            if getattr(runmode, "value", runmode) not in TRADE_MODES:
                return True
            if ":" not in pair:
                return True
            if side not in ("long", "short"):
                raise ValueError(f"side {side!r} is neither long nor short")
            if order_type not in ("market", "limit"):
                raise ValueError(f"order type {order_type!r} is neither market nor limit")
            params = {
                "coin": base_coin(pair),
                "side": side,
                "sizeUsd": float(amount) * float(rate),
                "holdHours": self.algovault_hold_hours,
                "orderType": order_type,
            }
            result = algovault_pre_trade.check(params, api_key=self.algovault_api_key, timeout=self.algovault_timeout)
        except Exception as exc:  # an exception here would enter the trade: block instead
            logger.warning("%s %s", pair, algovault_pre_trade.blocked_message(exc))
            return False
        decision = result.get("decision")
        codes = algovault_pre_trade.reason_codes(result)
        if decision == "WAIT":
            logger.warning(algovault_pre_trade.wait_message(params["coin"], side, codes))
            return False
        if decision not in ("GO", "CAUTION"):
            logger.warning("%s %s", pair, algovault_pre_trade.blocked_message(f"decision {decision!r}"))
            return False
        logger.info(algovault_pre_trade.pass_message(params["coin"], side, result))
        return True
