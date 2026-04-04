const STATIC_DISTRACTIONS = ['facebook.com', 'youtube.com', 'twitter.com', 'instagram.com', 'netflix.com', 'reddit.com', 'tiktok.com', 'twitch.tv'];
const STATIC_PRODUCTIVE = ['github.com', 'stackoverflow.com', 'localhost', 'docs.google.com', 'visualstudio.com', 'npmjs.com', 'pnpm.io'];

const GeminiHelper = {
    _apiKey: "AIzaSyBchvpvM6w_Z49IHwhNmHzXXRIJeXm1XTA",
    _model: "gemini-2.5-flash-lite",
    _timeoutMs: 8000, // 8s timeout — gemini-2.5-flash-lite is fast, this is generous

    async init() {
        return Promise.resolve(true);
    },

    async _callAPI(prompt) {
        if (!this._apiKey) return null;

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this._model}:generateContent?key=${this._apiKey}`;

        try {
            // Race the fetch against a timeout so we never block indefinitely
            const fetchPromise = fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Gemini timeout')), this._timeoutMs)
            );

            const response = await Promise.race([fetchPromise, timeoutPromise]);

            if (!response.ok) {
                const errBody = await response.text().catch(() => 'no body');
                console.warn(`Gemini AI Error ${response.status}: ${errBody}`);
                return null;
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return null;

            // Clean markdown blocks
            return text.replace(/```json/g, '').replace(/```/g, '').trim();
        } catch (err) {
            console.warn('Gemini AI Connectivity/Timeout:', err.message);
            return null;
        }
    },

    async analyzeTaskDuration(taskDescription) {
        const prompt = `You are a productivity coach. A user wants to focus on: "${taskDescription}".
Suggest an optimal focus duration in MINUTES (between 5 and 40, no breaks needed). Consider task complexity, cognitive load, and typical attention spans.
Return ONLY valid JSON: {"duration": <number 5-40>, "tip": "<short motivational tip>", "reason": "<1-2 sentence explanation of why this specific duration was chosen>"}`;
        const responseText = await this._callAPI(prompt);

        if (!responseText) {
            return { duration: 25, tip: "Let's focus on your task for a standard 25-minute sprint!", reason: "Defaulting to a classic Pomodoro sprint since the AI couldn't analyze your task." };
        }

        try {
            const parsed = JSON.parse(responseText);
            // Enforce 5-40 minute cap
            let duration = parseInt(parsed.duration) || 25;
            if (duration < 5) duration = 5;
            if (duration > 40) duration = 40;
            return {
                duration: duration,
                tip: parsed.tip || "Let's dive in.",
                reason: parsed.reason || `${duration} minutes is a good focused sprint for this type of task.`
            };
        } catch (e) {
            return { duration: 25, tip: "Stay focused!", reason: "Using a standard 25-minute block as a safe default." };
        }
    },

    async determineRelevance(taskName, currentUrl) {
        const urlObj = new URL(currentUrl);
        const domain = urlObj.hostname.toLowerCase();

        // 1. Check Local Static Rules First
        if (STATIC_DISTRACTIONS.some(d => domain.includes(d))) {
            return { isDistraction: true, nudgeMsg: "This site is a known black-hole. Let's get back to work!" };
        }
        if (STATIC_PRODUCTIVE.some(d => domain.includes(d))) {
            return { isDistraction: false, nudgeMsg: "" };
        }

        // 2. Try the AI
        const prompt = `Goal: "${taskName}". URL: "${currentUrl}". Is it helpful or distracting? Return ONLY JSON: {"isDistraction": true_or_false, "nudgeMsg": "nudge if true"}`;
        const responseText = await this._callAPI(prompt);

        if (!responseText) {
            return { isDistraction: false, nudgeMsg: "" };
        }

        try {
            const parsed = JSON.parse(responseText);
            return {
                isDistraction: !!parsed.isDistraction,
                nudgeMsg: parsed.nudgeMsg || "Let's refocus!"
            };
        } catch (e) {
            return { isDistraction: false, nudgeMsg: "" };
        }
    }
};

export default GeminiHelper;
