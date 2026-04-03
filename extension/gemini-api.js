const GeminiHelper = {
    _apiKey: "AIzaSyDE1HjIgY-tiv1T19sPGRN4PQhsH9zm6oc",

    async init() {
        return Promise.resolve(true);
    },

    async _callAPI(prompt) {
        if (!this._apiKey) {
            console.error('Gemini API key is missing. Initialize first.');
            return null;
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${this._apiKey}`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });

            if (!response.ok) {
                console.error('Failed to communicate with Gemini API.', await response.text());
                return null;
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (err) {
            console.error('Error fetching from Gemini API:', err);
            return null;
        }
    },

    async analyzeTaskDuration(taskDescription) {
        const prompt = `The user is doing the following task: "${taskDescription}". Suggest an optimal focus time in minutes (choose either 25, 50, or 90 based on typical complexity). Respond with ONLY a JSON object exactly matching this structure: {"duration": 25, "tip": "A 1-sentence contextual motivational tip"}`;

        const responseText = await this._callAPI(prompt);
        if (!responseText) return { duration: 25, tip: "Stay focused!" };

        try {
            const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            return {
                duration: parsed.duration || 25,
                tip: parsed.tip || "Let's dive in."
            };
        } catch (e) {
            console.error('Failed to parse Gemini response for task analysis.', responseText);
            return { duration: 25, tip: "Stay focused!" };
        }
    },

    async determineRelevance(taskName, currentUrl) {
        const prompt = `The user is currently focused on the task: "${taskName}". They just navigated to the URL: "${currentUrl}". Is this URL helpful or relevant for completing their task, or is it a distraction? Respond with ONLY a JSON block exactly like this: {"isDistraction": true_or_false, "nudgeMsg": "A short, gentle, and clever nudge to get them back on track (only if true, else empty)"}`;

        const responseText = await this._callAPI(prompt);
        if (!responseText) return { isDistraction: false, nudgeMsg: "" };

        try {
            const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            return {
                isDistraction: !!parsed.isDistraction,
                nudgeMsg: parsed.nudgeMsg || "Hey, is this website helping you with your goal? Let's refocus!"
            };
        } catch (e) {
            console.error('Failed to parse Gemini response for relevance detection.', responseText);
            return { isDistraction: false, nudgeMsg: "" };
        }
    }
};

export default GeminiHelper;
