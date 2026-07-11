# Runbook — Binance Skills Hub submission (canonical, reusable)

Human runbook for submitting / maintaining the AlgoVault skill on **Binance Skills Hub**
(`github.com/binance/binance-skills-hub`). The machine-consumed template + the SKILL.md
body live in [`SUBMIT_BINANCE.md`](SUBMIT_BINANCE.md) (generator input, CI-canary-guarded) —
this file is the process + state record so re-submission (or a new hub: OKX, etc.) is a
copy, not a rewrite.

> **Do NOT duplicate the SKILL.md body here.** It lives only in `SUBMIT_BINANCE.md`'s
> `SKILL_MD` block so the two can never drift. This runbook references it.

## Current state (2026-07-11)

| Item | Value |
|---|---|
| Upstream | `binance/binance-skills-hub` (open marketplace; `npx skills add <repo>`, Node ≥ 22) |
| Fork | `AlgoVaultFi/binance-skills-hub` (already exists) |
| Branch | `feature/algovault-skill` |
| **PR** | **[#254](https://github.com/binance/binance-skills-hub/pull/254) — OPEN** (created 2026-05-08, unengaged: 0 reviews/comments/checks) |
| Skill path (target) | `skills/algovault/signal-intelligence/SKILL.md` (nested, hub convention) |
| Skill name | `signal-intelligence` · author `AlgoVaultFi` · MIT |

**The submission is already live as PR #254 — do NOT open a second PR** (duplicate = spam; violates the anti-spam distribution rule). The pending work is a **refresh in place** of PR #254 to current live truth. Any push to the public PR is architect-gated (see below).

## Why a refresh is needed (drift vs live, probed 2026-07-11)

PR #254's SKILL.md was generated 2026-05-08 and is stale on every axis:

1. Frontmatter `title:` → every **merged** hub skill uses `name:` (README template is stale; CONTRIBUTING requires `name`). ⇒ `SUBMIT_BINANCE.md` now emits `name:`.
2. Path flat `skills/algovault/SKILL.md` → hub convention is two-level `skills/<ns>/<skill>/`. ⇒ nested `skills/algovault/signal-intelligence/`.
3. Response shape guessed (`signal`, `factors.rsi/ema`) → real fields are `call` + `indicators.{funding_rate,oi_change_pct,trend_persistence,...}` + `_receipts.{track_record.pfe_win_rate, verification_uri, disclaimer}` (verified via live `tools/call`).
4. Hardcoded stale numbers (90.1% / 78,000+ / 28 / "5 exchanges") → placeholders, regenerated live (91.7% / 349k+ / 92 batches / 12 venues at time of writing).
5. `author: AlgoVaultLabs` → `AlgoVaultFi` (README = your GitHub username).
6. No testnet-safe example, no per-tool reference, no disclaimer → all added.

## Regenerate the artifacts (live numbers, never hardcoded)

```bash
cd algovault-skills
node scripts/generate_skill_submission.mjs --exchange BINANCE
# → <output-dir>/{SKILL.md, PR_TITLE.txt, PR_BODY.md, SUMMARY.md}
# Placeholders (<PFE_WR>, <TOTAL_CALLS>, <BATCH_COUNT>, <VERSION>) are filled from
# /api/performance-public + /api/merkle-batches + /health at run time.
```

Verify before use:

```bash
grep -iE 'outcome_return_pct|outcome_price|phase e' <output-dir>/SKILL.md   # → 0 matches (internal-metrics firewall)
grep -ioE '0x[a-f0-9]{40}'                          <output-dir>/SKILL.md   # → 0 matches (CONTRIBUTING: no wallet addresses)
grep -c  'get_trade_signal'                          <output-dir>/SKILL.md   # → 0 (canonical get_trade_call only)
node --test tests/unit/submit-template-consistency.test.mjs                  # → green (no hardcoded literals in template)
```

## Refresh the OPEN PR #254 (architect-gated — the one outward action)

```bash
gh repo clone AlgoVaultFi/binance-skills-hub && cd binance-skills-hub
git checkout feature/algovault-skill && git pull origin feature/algovault-skill
git rm skills/algovault/SKILL.md 2>/dev/null || true
mkdir -p skills/algovault/signal-intelligence
cp <output-dir>/SKILL.md skills/algovault/signal-intelligence/SKILL.md
git add skills/algovault/signal-intelligence/SKILL.md
git commit -m "feat(skills): refresh AlgoVault signal-intelligence skill (name: schema, nested path, live shape)"
git push origin feature/algovault-skill          # ← updates PR #254 (no new PR)
gh pr edit 254 --repo binance/binance-skills-hub \
  --title "$(cat <output-dir>/PR_TITLE.txt)" --body-file <output-dir>/PR_BODY.md
```

**Gate:** pushing to / editing PR #254 is an outward, spam-sensitive action on a Binance-org
surface from a recently-un-flagged account. Get architect (Mr.1) go/no-go on the final
SKILL.md + PR body before running the `push` / `gh pr edit`. If declined, leave the refreshed
artifacts staged locally; nothing is pushed.

## Re-submit to another hub (copy-not-rewrite)

The template system generalises: add `docs/SUBMIT_<HUB>.md` with a `SKILL_MD` block + PR
markers, then `node scripts/generate_skill_submission.mjs --exchange <HUB>`. The CI canary
`tests/unit/submit-template-consistency.test.mjs` keeps every template literal-free. Mirror
the target hub's **merged** skills for its exact frontmatter/path conventions before drafting
(don't trust its README template — Binance's was stale).

## Positioning (LAW)

Canonical tagline "The Brain Layer for AI Trading Agents." Frame as cross-venue signal
interpretation **additive to the venue's execution** — never "trade on Binance," never a
competitor to Binance's own skills. Public metric = PFE Win Rate only; `outcome_return_pct` /
Phase-E WR are internal and never surfaced.
