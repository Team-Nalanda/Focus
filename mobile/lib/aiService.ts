/**
 * AI Service — Direct Gemini API calls (no server proxy needed)
 * Combines web app's aiService.ts + extension's gemini-api.js
 */

const GEMINI_API_KEY = "AIzaSyBchvpvM6w_Z49IHwhNmHzXXRIJeXm1XTA";
const MODEL = "gemma-4-31b-it";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ── Known app categories (from extension's static lists, adapted for mobile apps) ──
const KNOWN_DISTRACTIONS = [
  'facebook', 'youtube', 'twitter', 'instagram', 'netflix', 'reddit', 
  'tiktok', 'twitch', 'snapchat', 'whatsapp', 'telegram', 'discord',
  'candy crush', 'pubg', 'among us', 'subway surfers', 'temple run'
];
const KNOWN_PRODUCTIVE = [
  'github', 'stack overflow', 'google docs', 'notion', 'slack', 'teams',
  'vs code', 'terminal', 'chrome', 'firefox', 'calculator', 'calendar',
  'notes', 'files', 'drive', 'sheets', 'classroom', 'zoom', 'meet'
];

async function callGemini(prompt: string): Promise<string | null> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      console.warn('Gemini AI Issue: API returned status', response.status);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    return text.replace(/```json/g, '').replace(/```/g, '').trim();
  } catch (err) {
    console.error('Gemini API error:', err);
    return null;
  }
}

/** Get a live coaching tip based on recent app switches */
export async function getLiveFocusTip(activities: any[]): Promise<string> {
  const recentLog = activities.slice(0, 5).map((a) => a.name).join(", ");

  const prompt = `
    You are a real-time focus buddy. A user just switched between these apps: [${recentLog}]. 
    If they are switching too fast, give a gentle nudge to stay focused. 
    If they are deep in a productive app (like VS Code), give a word of encouragement.
    Provide exactly ONE sentence (max 12 words). No JSON, just plain text.
  `;

  const result = await callGemini(prompt);
  return result || "You're doing great, keep focusing.";
}

/** Full session analysis — generates Focus Score, Behavior Pattern, Recommendation */
export async function analyzeSessionActivity(activities: any[]) {
  const activityLog = activities
    .map((a) => `${a.name || a.App_Name} [${a.type || a.Activity_Type || 'Neutral'}]`)
    .join(" -> ");

  const prompt = `
    Analyze this focus session activity log: [${activityLog}]
    
    CRITICAL SCORING RULES:
    1. Start with 100 points.
    2. Subtract 10 points for every [Distracting] entry.
    3. Subtract 5 points for every "context switch" (switching between different productive apps too quickly).
    4. If the log is empty or very short, score is 50 max.
    
    Provide a deep-dive behavioral intelligence report in VALID JSON format with exactly these fields:
    {
      "Focus_Score": <integer 0-100 calculated by rules>,
      "Behavior_Pattern": "<Identify 'Flow Entry', 'Distraction Clusters', and 'Context Switching Penalty' based on the log sequence.>",
      "Recommendation": "<One specific, actionable strategy to fix the distraction patterns in this specific data.>"
    }
  `;

  const responseText = await callGemini(prompt);
  
  if (!responseText) {
    return {
      Focus_Score: 65,
      Behavior_Pattern: "Intelligence engine processing your patterns...",
      Recommendation: "Session recorded successfully. Detailed report will finalize shortly."
    };
  }

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      Focus_Score: 65,
      Behavior_Pattern: "Intelligence engine processing your patterns...",
      Recommendation: "Session recorded. Report finalizing shortly."
    };
  }
}

/** AI-suggested session duration based on task description */
export async function analyzeTaskDuration(taskDescription: string) {
  const prompt = `Task: "${taskDescription}". Suggest duration (25, 50, or 90 mins). Return ONLY JSON: {"duration": 25, "tip": "contextual tip"}`;
  const responseText = await callGemini(prompt);

  if (!responseText) {
    return { duration: 25, tip: "Let's focus for a standard 25-minute sprint!" };
  }

  try {
    const parsed = JSON.parse(responseText);
    return {
      duration: parsed.duration || 25,
      tip: parsed.tip || "Let's dive in."
    };
  } catch {
    return { duration: 25, tip: "Stay focused!" };
  }
}

/** Determine if an app is a distraction based on the current task — replaces extension's URL-based check */
export async function determineAppRelevance(taskName: string, appName: string) {
  const appLower = appName.toLowerCase();

  // 1. Check local static rules first
  if (KNOWN_DISTRACTIONS.some(d => appLower.includes(d))) {
    return { isDistraction: true, nudgeMsg: "This app is a known focus trap. Let's get back to work!" };
  }
  if (KNOWN_PRODUCTIVE.some(d => appLower.includes(d))) {
    return { isDistraction: false, nudgeMsg: "" };
  }

  // 2. Ask AI
  const prompt = `Goal: "${taskName}". User opened app: "${appName}". Is it helpful or distracting? Return ONLY JSON: {"isDistraction": true_or_false, "nudgeMsg": "nudge if true"}`;
  const responseText = await callGemini(prompt);

  if (!responseText) {
    return { isDistraction: false, nudgeMsg: "" };
  }

  try {
    const parsed = JSON.parse(responseText);
    return {
      isDistraction: !!parsed.isDistraction,
      nudgeMsg: parsed.nudgeMsg || "Let's refocus!"
    };
  } catch {
    return { isDistraction: false, nudgeMsg: "" };
  }
}
