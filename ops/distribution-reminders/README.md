# Distribution Reminders — operator runbook

`send.sh` fires a Telegram reminder for one day's exchange submission in the
DISTRIBUTION-CLOSEOUT-W1 4-day cadence (Bybit / Bitget / Binance after Day 0
OKX).

## Install on signal-MCP host (already done in DISTRIBUTION-CLOSEOUT-W1)

```bash
scp ops/distribution-reminders/send.sh root@204.168.185.24:/opt/algovault-distribution-reminders/send.sh
ssh root@204.168.185.24 "chmod +x /opt/algovault-distribution-reminders/send.sh"
```

## Schedule (already queued via `at`)

```bash
ssh root@204.168.185.24 "
echo '/opt/algovault-distribution-reminders/send.sh 1 Bybit \"https://github.com/bybit-exchange/trading-mcp/issues/new\"' | at -M '14:00 2026-04-29'
echo '/opt/algovault-distribution-reminders/send.sh 2 Bitget \"https://github.com/BitgetLimited/agent_hub/issues/new\"' | at -M '14:00 2026-04-30'
echo '/opt/algovault-distribution-reminders/send.sh 3 Binance \"https://github.com/binance/binance-skills-hub\"' | at -M '14:00 2026-05-01'
"
```

## 2026-05-01 lesson learned (root cause of Apr 29 + Apr 30 silent failures)

The original send.sh used `parse_mode=Markdown` on Telegram's `sendMessage`
endpoint. That parser interprets `_` as italic-start and rejects unmatched
underscores with HTTP 400. URLs containing underscores (e.g. `agent_hub`,
`trading-mcp`) tripped this consistently. **Both the Apr 29 (Bybit) and
Apr 30 (Bitget) at-fired reminders silently failed** because:

1. Telegram returned HTTP 400 instead of 200
2. `at` discards stdout/stderr by default (no /var/mail/root MTA configured)
3. The script had no explicit HTTP-status check, so it exited 0 anyway

**Fix:** dropped `parse_mode` entirely (plain text — no markdown surprises),
added per-fire log to `/var/log/algovault-distribution-reminders.log`,
added explicit `HTTP 200` check that exits 1 on failure.

**Smoke-test gotcha:** the original "smoke test" used `https://example.com/test`
as the URL — no underscores, so it accidentally passed even though every real
exchange URL had the bug. Lesson: smoke tests must use **production-shaped**
inputs (real URLs with the same special chars) to catch this class of bug.

## Manual fire (for retro-recovery or testing)

```bash
ssh root@204.168.185.24 "/opt/algovault-distribution-reminders/send.sh <day-num> <exchange> '<target-url>'"
```

## Verify after fire

```bash
ssh root@204.168.185.24 "tail -5 /var/log/algovault-distribution-reminders.log"
# Expect: HTTP 200 in the response line
```
