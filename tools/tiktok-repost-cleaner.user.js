// ==UserScript==
// @name         TikTok Repost Cleaner
// @namespace    local.tiktok.repost-cleaner
// @version      1.0.1
// @description  Slowly removes reposts from your own TikTok profile, with pause and safety controls.
// @match        https://tiktok.com/*
// @match        https://www.tiktok.com/*
// @match        https://*.tiktok.com/*
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @noframes
// ==/UserScript==

/* global GM_addStyle, GM_deleteValue, GM_getValue, GM_setValue */

(() => {
  "use strict";

  const STORE_KEY = "tiktok-repost-cleaner-state-v1";
  const PANEL_ID = "trc-panel";
  const SESSION_LIMIT = 50;
  const MIN_DELAY_MS = 5000;
  const MAX_DELAY_MS = 9000;
  const TAB_ID_KEY = "tiktok-repost-cleaner-tab-id";
  const makeId = () =>
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tabId = sessionStorage.getItem(TAB_ID_KEY) || makeId();
  sessionStorage.setItem(TAB_ID_KEY, tabId);

  const freshState = () => ({
    running: false,
    ownerId: "",
    phase: "idle",
    profileUrl: "",
    currentVideo: "",
    removed: 0,
    removedThisSession: 0,
    emptyChecks: 0,
    message: "Open your profile's Reposts tab to begin.",
    nextActionAt: 0,
  });

  let state = { ...freshState(), ...GM_getValue(STORE_KEY, {}) };
  let working = false;

  const save = (patch = {}) => {
    state = { ...state, ...patch };
    GM_setValue(STORE_KEY, state);
    render();
  };

  const randomDelay = () =>
    Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;

  const ownsRun = () => {
    const saved = GM_getValue(STORE_KEY, {});
    return Boolean(saved.running && saved.ownerId === tabId);
  };

  const isVisible = (element) => {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  };

  const normalizedText = (element) => (element.textContent || "").replace(/\s+/g, " ").trim();

  const waitFor = async (finder, timeoutMs, intervalMs = 250) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && state.running && ownsRun()) {
      const result = finder();
      if (result) return result;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return null;
  };

  const click = (element) => {
    element.scrollIntoView({ block: "center", inline: "center" });
    element.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
    }));
  };

  const isProfilePage = () => /^\/@[^/]+\/?$/.test(location.pathname);
  const isVideoPage = () => /\/@[^/]+\/video\/\d+/.test(location.pathname);

  const findVideoLinks = () => {
    const root = document.querySelector("main") || document;
    const links = [...root.querySelectorAll('a[href*="/video/"]')]
      .filter(isVisible)
      .filter((link) => /\/@[^/]+\/video\/\d+/.test(link.pathname));

    return [...new Map(links.map((link) => [link.href.split("?")[0], link])).values()];
  };

  const findShareButton = () => {
    const selectors = [
      '[data-e2e="share-icon"]',
      '[data-e2e="browse-share-icon"]',
      'button[aria-label="Share"]',
      '[role="button"][aria-label="Share"]',
    ];

    for (const selector of selectors) {
      const icon = [...document.querySelectorAll(selector)].find(isVisible);
      if (!icon) continue;
      const control = icon.closest('button, [role="button"]') || icon;
      if (isVisible(control)) return control;
    }

    return null;
  };

  const findRemoveRepostButton = () => {
    const candidates = [...document.querySelectorAll('button, [role="button"], [role="menuitem"], li, span')];
    const label = candidates.find((element) => isVisible(element) && normalizedText(element) === "Remove repost");
    if (!label) return null;

    const control = label.closest('button, [role="button"], [role="menuitem"], li') || label;
    return isVisible(control) ? control : null;
  };

  const pauseWithError = (message) => {
    save({ running: false, phase: "error", message });
  };

  const openNextVideo = async () => {
    if (state.removedThisSession >= SESSION_LIMIT) {
      save({
        running: false,
        phase: "paused",
        message: `Paused after ${SESSION_LIMIT} removals. Let TikTok rest, then press Resume.`,
      });
      return;
    }

    const links = findVideoLinks();
    if (!links.length) {
      const emptyChecks = state.emptyChecks + 1;
      if (emptyChecks >= 10) {
        save({
          running: false,
          phase: "complete",
          emptyChecks: 0,
          message: "No repost tiles remain. Finished.",
        });
        return;
      }

      save({ emptyChecks, message: "Looking for more reposts..." });
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      return;
    }

    const link = links[0];
    const videoUrl = link.href.split("?")[0];
    save({
      phase: "opening",
      currentVideo: videoUrl,
      emptyChecks: 0,
      message: "Opening the next repost...",
      nextActionAt: Date.now() + randomDelay(),
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (!ownsRun()) return;
    click(link);
  };

  const removeCurrentRepost = async () => {
    save({ phase: "removing", message: "Waiting for the Share control..." });
    const shareButton = await waitFor(findShareButton, 12000);
    if (!shareButton) {
      if (!ownsRun()) return;
      pauseWithError("Paused: Share was not found. Handle any verification prompt, then press Resume.");
      return;
    }

    click(shareButton);
    const removeButton = await waitFor(findRemoveRepostButton, 6000);
    if (!removeButton) {
      if (!ownsRun()) return;
      pauseWithError('Paused safely: the exact "Remove repost" option was not found.');
      return;
    }

    if (!ownsRun()) return;
    click(removeButton);
    save({
      phase: "returning",
      removed: state.removed + 1,
      removedThisSession: state.removedThisSession + 1,
      message: "Removed. Returning to your Reposts tab...",
      nextActionAt: Date.now() + randomDelay(),
    });
    await new Promise((resolve) => setTimeout(resolve, 1800));
    history.back();
  };

  const tick = async () => {
    state = { ...state, ...GM_getValue(STORE_KEY, {}) };
    render();
    if (working || !state.running || state.ownerId !== tabId || Date.now() < state.nextActionAt) return;
    working = true;

    try {
      if (isProfilePage()) {
        if (state.phase === "returning") {
          save({ phase: "browsing", currentVideo: "", message: "Loading the next repost..." });
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        await openNextVideo();
      } else if (isVideoPage()) {
        await removeCurrentRepost();
      } else {
        pauseWithError("Paused: return to the Reposts tab on your own profile, then press Resume.");
      }
    } catch (error) {
      console.error("TikTok Repost Cleaner stopped:", error);
      pauseWithError("Paused after an unexpected page error. Nothing else will be clicked.");
    } finally {
      working = false;
    }
  };

  const start = () => {
    if (!isProfilePage()) {
      save({ message: "First open the Reposts tab on your own TikTok profile." });
      return;
    }

    const confirmed = window.confirm(
      "Is the Reposts tab on YOUR profile selected?\n\n" +
      "This will remove reposts, up to 50 per session. Keep this tab open."
    );
    if (!confirmed) return;

    save({
      running: true,
      ownerId: tabId,
      phase: "browsing",
      profileUrl: location.href,
      currentVideo: "",
      removedThisSession: 0,
      emptyChecks: 0,
      nextActionAt: Date.now() + 1000,
      message: "Starting slowly. Keep this tab open...",
    });
  };

  const resume = () => {
    if (isVideoPage() && state.currentVideo) {
      save({
        running: true,
        ownerId: tabId,
        phase: "opening",
        removedThisSession: 0,
        nextActionAt: Date.now() + 1000,
        message: "Retrying this repost...",
      });
      return;
    }

    if (!isProfilePage()) {
      save({ message: "Return to your profile's Reposts tab before resuming." });
      return;
    }

    save({
      running: true,
      ownerId: tabId,
      phase: "browsing",
      removedThisSession: 0,
      emptyChecks: 0,
      nextActionAt: Date.now() + 1000,
      message: "Resuming...",
    });
  };

  const pause = () => save({ running: false, phase: "paused", message: "Paused by you." });

  const skip = () => {
    if (!isVideoPage()) return;
    save({
      running: false,
      phase: "paused",
      currentVideo: "",
      message: "Skipped this video. Press Resume on the Reposts tab.",
    });
    history.back();
  };

  const reset = () => {
    if (!window.confirm("Reset the cleaner's counter and saved state?")) return;
    GM_deleteValue(STORE_KEY);
    state = freshState();
    render();
  };

  const panelMarkup = () => `
    <div class="trc-title">Repost Cleaner</div>
    <div class="trc-count"><strong>${state.removed}</strong> removed</div>
    <div class="trc-status">${state.message}</div>
    <div class="trc-actions">
      <button type="button" data-action="${state.running ? "pause" : state.phase === "idle" ? "start" : "resume"}">
        ${state.running ? "Pause" : state.phase === "idle" ? "Start" : "Resume"}
      </button>
      ${isVideoPage() ? '<button type="button" data-action="skip" class="trc-secondary">Skip</button>' : ""}
      <button type="button" data-action="reset" class="trc-secondary">Reset</button>
    </div>
    <div class="trc-note">English UI only. Stops every ${SESSION_LIMIT} removals.</div>
  `;

  function render() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.innerHTML = panelMarkup();
  }

  const mount = () => {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.innerHTML = panelMarkup();
    panel.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      ({ start, resume, pause, skip, reset })[button.dataset.action]?.();
    });
    document.body.appendChild(panel);
  };

  GM_addStyle(`
    #${PANEL_ID} {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483647;
      width: min(310px, calc(100vw - 36px));
      box-sizing: border-box;
      padding: 14px;
      border: 1px solid #3f3f46;
      border-radius: 8px;
      background: #18181b;
      color: #fafafa;
      font: 14px/1.4 system-ui, sans-serif;
      letter-spacing: 0;
      box-shadow: 0 12px 28px rgba(0, 0, 0, .35);
    }
    #${PANEL_ID} .trc-title { font-size: 16px; font-weight: 700; }
    #${PANEL_ID} .trc-count { margin-top: 8px; color: #d4d4d8; }
    #${PANEL_ID} .trc-count strong { color: #2dd4bf; font-size: 20px; }
    #${PANEL_ID} .trc-status { min-height: 40px; margin-top: 8px; color: #e4e4e7; }
    #${PANEL_ID} .trc-actions { display: flex; gap: 8px; margin-top: 10px; }
    #${PANEL_ID} button {
      min-height: 36px;
      padding: 7px 13px;
      border: 1px solid #fe2c55;
      border-radius: 6px;
      background: #fe2c55;
      color: white;
      cursor: pointer;
      font: inherit;
      font-weight: 650;
      letter-spacing: 0;
    }
    #${PANEL_ID} button:hover { filter: brightness(1.08); }
    #${PANEL_ID} button.trc-secondary { border-color: #52525b; background: #27272a; }
    #${PANEL_ID} .trc-note { margin-top: 9px; color: #a1a1aa; font-size: 11px; }
  `);

  mount();
  setInterval(() => {
    mount();
    render();
    void tick();
  }, 1200);
})();
