"""A sample Freqtrade strategy whose entries go through AlgoVault's pre_trade_check.

The signal is a plain EMA cross, there to have entries to gate. The gate is the first
base class: AlgoVaultPreTradeGate.confirm_trade_entry runs the check in live and dry-run
and skips the entry on WAIT or when the check cannot run.

Copy GatedStrategy.py, algovault_gate.py and ../_shared/algovault_pre_trade.py into
user_data/strategies/, then:

    freqtrade trade --dry-run --strategy GatedStrategy --config config.json
"""

from __future__ import annotations

from freqtrade.strategy import IStrategy
from pandas import DataFrame

from algovault_gate import AlgoVaultPreTradeGate


class GatedStrategy(AlgoVaultPreTradeGate, IStrategy):
    INTERFACE_VERSION = 3

    timeframe = "1h"
    can_short = True
    minimal_roi = {"0": 0.04}
    stoploss = -0.02
    startup_candle_count = 30

    # pre_trade_check's hold window, in hours: sets the funding cost it weighs.
    algovault_hold_hours = 8

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema_fast"] = dataframe["close"].ewm(span=12, adjust=False).mean()
        dataframe["ema_slow"] = dataframe["close"].ewm(span=26, adjust=False).mean()
        above = dataframe["ema_fast"] > dataframe["ema_slow"]
        dataframe["cross_up"] = above & ~above.shift(1, fill_value=False)
        dataframe["cross_down"] = ~above & above.shift(1, fill_value=False)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[dataframe["cross_up"], "enter_long"] = 1
        dataframe.loc[dataframe["cross_down"], "enter_short"] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[dataframe["cross_down"], "exit_long"] = 1
        dataframe.loc[dataframe["cross_up"], "exit_short"] = 1
        return dataframe
