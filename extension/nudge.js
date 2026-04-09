(function () {
    // Prevent re-showing if already mounted
    if (document.getElementById('focus-nudge-root')) return;

    // We no longer use window-level flag for this since we check the DOM

    const message = window.focusNudgeMessage
        || "This site doesn't seem related to your current task.";

    // Create host element
    const host = document.createElement('div');
    host.id = 'focus-nudge-root';
    document.documentElement.appendChild(host);

    // Attach Shadow DOM so styles don't conflict
    const shadow = host.attachShadow({ mode: 'open' });

    // Load the CSS file
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('nudge.css');
    shadow.appendChild(link);

    // Create UI
    const card = document.createElement('div');
    card.id = 'focus-nudge-card';
    card.innerHTML = `
        <div id="focus-nudge-progress-track">
            <div id="focus-nudge-progress-bar"></div>
        </div>
        <div id="focus-nudge-body">
            <div id="focus-nudge-header">
                <div id="focus-nudge-icon-wrap">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <div id="focus-nudge-text-group">
                    <span id="focus-nudge-label">Distraction Detected</span>
                    <span id="focus-nudge-title">FocusFlow AI</span>
                </div>
                <!-- Remove Close Button to enforce decision making, or keep it as Snooze -->
            </div>
            <span id="focus-nudge-message">${message}</span>
        </div>
        <div id="focus-nudge-footer">
            <button id="focus-nudge-btn-back" class="focus-nudge-btn">Keep Focusing</button>
            <button id="focus-nudge-btn-snooze" class="focus-nudge-btn">Snooze (1m)</button>
            <button id="focus-nudge-btn-end" class="focus-nudge-btn">End Session</button>
        </div>
    `;

    shadow.appendChild(card);

    const removeNudge = () => {
        card.classList.add('focus-nudge-leaving');
        setTimeout(() => host.remove(), 400); // let animation finish
    };

    // Add progress bar animation
    const bar = shadow.getElementById('focus-nudge-progress-bar');
    if (bar) {
        bar.style.setProperty('transition-duration', '15s', 'important');
        setTimeout(() => { bar.style.transform = 'scaleX(0)'; }, 50);
    }

    const autoWait = setTimeout(() => {
        removeNudge();
    }, 15000);

    shadow.getElementById('focus-nudge-btn-back').addEventListener('click', () => {
        clearTimeout(autoWait);
        removeNudge();
        history.back(); // May not work on new tabs, but it's standard
    });

    shadow.getElementById('focus-nudge-btn-snooze').addEventListener('click', () => {
        clearTimeout(autoWait);
        removeNudge();
    });

    shadow.getElementById('focus-nudge-btn-end').addEventListener('click', () => {
        clearTimeout(autoWait);
        chrome.runtime.sendMessage({ action: "SESSION_ENDED" });
        removeNudge();
    });
})();
