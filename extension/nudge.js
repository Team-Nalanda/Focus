(function () {
    // Prevent re-showing if already shown on this page load
    if (window.__focusNudgeShown) return;
    window.__focusNudgeShown = true;

    const message = window.focusNudgeMessage
        || "This site doesn't seem related to your current task.";

    const title = "🎯 FocusFlow AI — Distraction Detected";
    const body = `${message}\n\nClick OK to go back to work.\nClick Cancel to end your focus session.`;

    const stayFocused = confirm(`${title}\n\n${body}`);

    if (stayFocused) {
        // User chose to go back — navigate back in history
        history.back();
    } else {
        // User chose to end the session
        chrome.runtime.sendMessage({ action: "SESSION_ENDED" });
    }

    // Reset flag after 60s so it can show again if user stays on the site
    setTimeout(() => { window.__focusNudgeShown = false; }, 60000);
})();
