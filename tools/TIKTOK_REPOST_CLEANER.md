# TikTok Repost Cleaner

This userscript removes reposts through TikTok's visible web controls. It does
not ask for a password, call a private API, collect video data, or bypass a
verification prompt.

## Install

1. Install a userscript manager such as Tampermonkey in a desktop browser.
2. Create a new userscript.
3. Replace the template with the contents of `tiktok-repost-cleaner.user.js`.
4. Save it, then open `https://www.tiktok.com/` and sign in normally.

## Run

1. Open your own profile and select the **Reposts** tab.
2. Confirm visually that repost tiles, rather than your posted videos, are shown.
3. Press **Start** in the Repost Cleaner panel and confirm the warning.
4. Keep the TikTok tab open. You can press **Pause** at any time.

The cleaner removes at most 50 reposts per session, then pauses. Wait before
pressing **Resume**. This limit and the randomized 5-9 second delays reduce load,
but TikTok can still rate-limit or restrict automated activity.

The script is intentionally English-only because it requires the exact visible
label `Remove repost`. If TikTok changes its interface, shows a CAPTCHA, or the
expected control is missing, the cleaner pauses instead of clicking another
option. Use **Skip** for an unavailable video.

## Panel not showing

1. In Chrome 138 or newer, open `chrome://extensions`, select **Details** under
   Tampermonkey, and enable **Allow User Scripts**.
2. In older Chrome versions, open `chrome://extensions` and enable
   **Developer mode** in the top-right corner.
3. On Tampermonkey's extension details page, set site access to allow TikTok.
4. Confirm the cleaner is enabled in the Tampermonkey dashboard, then completely
   reload the TikTok tab.

Removing a repost cannot be undone by this script. TikTok does not currently
document a bulk removal feature, so use this at your own risk and review the
terms that apply in your region.
