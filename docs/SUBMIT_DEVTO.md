# Manual submission — Dev.to cross-posts (4 articles)

This file ships the ready-to-paste content for cross-posting the 4 integration tutorials to Dev.to. The C6 gate fell back to manual submission because `DEV_TO_API_KEY` is not present in `~/.algovault/secrets` or in any repo `.env` (verified 2026-04-25).

## To enable auto-publish (one-time, ~3 min)

1. Sign in at <https://dev.to/settings/extensions>.
2. Scroll to **DEV API Keys** → click **Generate API Key** → copy the key.
3. Save the key:
   ```bash
   mkdir -p ~/.algovault && echo "DEV_TO_API_KEY=<paste_here>" >> ~/.algovault/secrets
   chmod 600 ~/.algovault/secrets
   ```
4. Re-run a future C6-class wave with auto-publish enabled.

## Manual submission flow (for THIS wave)

For each of the 4 articles below: open <https://dev.to/new>, paste the body, set the title + canonical URL + tags, click **Publish**. ~3 minutes per article.

After publishing, paste the resulting URL into `docs/INTEGRATIONS_DISTRIBUTION.md` `devto_url` column for the corresponding row + flip status from `MANUAL_PENDING` to `LIVE`.

---

## Article 1 — Binance

**Title:** `AlgoVault × Binance: Brain + Execution for AI Trading Agents`
**Canonical URL:** `https://algovault.com/docs/integrations/binance`
**Tags:** `crypto, mcp, ai, trading`
**Cover image:** (optional — use AlgoVault logo from <https://algovault.com/logo.png>)

**Body (paste into the Dev.to editor — markdown):**

> Use the body from `docs/integrations/binance.md` BUT with the UTM channel changed from `repo` to `devto`:
>
> ```bash
> sed 's/utm_medium=repo&utm_campaign=integration-binance/utm_medium=devto\&utm_campaign=integration-binance/g' \
>   docs/integrations/binance.md > /tmp/binance-devto.md
> # Then copy /tmp/binance-devto.md into the Dev.to editor.
> ```

**At the bottom of the body, append:**

> *Originally published at <https://algovault.com/docs/integrations/binance> · MIT licensed*

---

## Article 2 — OKX

**Title:** `AlgoVault × OKX: Brain + Execution for AI Trading Agents`
**Canonical URL:** `https://algovault.com/docs/integrations/okx`
**Tags:** `crypto, mcp, ai, trading`

**Body:** Use `docs/integrations/okx.md` with the same `repo` → `devto` UTM rewrite as Article 1.

---

## Article 3 — Bybit

**Title:** `AlgoVault × Bybit: Brain + Execution for AI Trading Agents`
**Canonical URL:** `https://algovault.com/docs/integrations/bybit`
**Tags:** `crypto, mcp, ai, trading`

**Body:** Use `docs/integrations/bybit.md` with the same `repo` → `devto` UTM rewrite.

---

## Article 4 — Bitget

**Title:** `AlgoVault × Bitget: Brain + Execution for AI Trading Agents`
**Canonical URL:** `https://algovault.com/docs/integrations/bitget`
**Tags:** `crypto, mcp, ai, trading`

**Body:** Use `docs/integrations/bitget.md` with the same `repo` → `devto` UTM rewrite.

---

## Notes

- Setting `canonical_url` is critical: Dev.to (and Google) treat the canonical URL as the master version, avoiding duplicate-content SEO penalties on `algovault.com` itself.
- Tags should stay at 4 (Dev.to enforces a hard 4-tag cap).
- Don't enable Dev.to's "auto-tweet on publish" — we control distribution timing separately.
- After all 4 are published, return here and update `docs/INTEGRATIONS_DISTRIBUTION.md`.
