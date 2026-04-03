(function() {
    // Prevent multiple nudges
    if (document.getElementById('focus-nudge-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'focus-nudge-overlay';

    // Get the nudge message from the background via a global variable or hidden input
    // For simplicity, we'll assume the message is passed in or we use a default
    const message = window.focusNudgeMessage || "You've wandered off track. The AI noticed this site might not be part of your current task.";

    overlay.innerHTML = `
        <div class="focus-nudge-content">
            <div class="focus-nudge-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-brain"><path d="M9.5 2a.5.5 0 0 1 .5.5v.3a.5.5 0 0 1-.5.5h-.3a.5.5 0 0 1-.5-.5v-.3a.5.5 0 0 1 .5-.5h.3Z"/><path d="M9.5 5a.5.5 0 0 1 .5.5v.3a.5.5 0 0 1-.5.5h-.3a.5.5 0 0 1-.5-.5v-.3a.5.5 0 0 1 .5-.5h.3Z"/><path d="M14.5 2a.5.5 0 0 1 .5.5v.3a.5.5 0 0 1-.5.5h-.3a.5.5 0 0 1-.5-.5v-.3a.5.5 0 0 1 .5-.5h.3Z"/><path d="M14.5 5a.5.5 0 0 1 .5.5v.3a.5.5 0 0 1-.5.5h-.3a.5.5 0 0 1-.5-.5v-.3a.5.5 0 0 1 .5-.5h.3Z"/><path d="M20 9V8a2 2 0 0 0-2-2h-1c0-1.67-.83-3.15-2.09-4.04a2 2 0 0 0-2.41 0C11.23 2.85 10.4 4.33 10.4 6H9.4a2 2 0 0 0-2 2v1"/><path d="M14 13.1a3.5 3.5 0 1 0-4 0"/><path d="M12 15v5"/><path d="M9 18h6"/><path d="M21 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M7 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M2 13h2"/><path d="M20 13h2"/><path d="M12 2v1"/><path d="M12 7v1"/></svg>
            </div>
            <h2 class="focus-nudge-title">Back to Focus?</h2>
            <p class="focus-nudge-msg">${message}</p>
            <div class="focus-nudge-footer">
                <button id="focus-nudge-resume" class="focus-nudge-btn focus-nudge-btn-primary">I'm back to work</button>
                <button id="focus-nudge-stop" class="focus-nudge-btn focus-nudge-btn-secondary">End Session</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Event Listeners
    document.getElementById('focus-nudge-resume').addEventListener('click', () => {
        overlay.remove();
    });

    document.getElementById('focus-nudge-stop').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "SESSION_ENDED" });
        overlay.remove();
    });
})();
