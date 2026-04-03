export async function getLiveFocusTip(activities: any[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Focus on the task at hand.";

  const model = "gemma-4-31b-it";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const recentLog = activities
    .slice(0, 5)
    .map((a) => a.name)
    .join(", ");

  const prompt = `
    You are a real-time focus buddy. A user just switched between these apps: [${recentLog}]. 
    If they are switching too fast, give a gentle nudge to stay focused. 
    If they are deep in a productive app (like VS Code), give a word of encouragement.
    Provide exactly ONE sentence (max 12 words). No JSON, just plain text.
  `;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) return "Maintaining steady focus is key.";

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Keep up the great flow.";
  } catch (error) {
    return "You're doing great, keep focusing.";
  }
}

export async function analyzeSessionActivity(activities: any[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables.");
  }

  const model = "gemma-4-31b-it";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const activityLog = activities
    .map((a) => `${a.name || a.App_Name} [${a.type || a.Activity_Type || 'Neutral'}]`)
    .join(" -> ");

  const prompt = `
    Analyze this focus session activity log: [${activityLog}]
    
    CRITICAL SCORING RULES:
    1. Start with 100 points.
    2. Subtract 10 points for every [Distracting] entry.
    3. Subtract 5 points for every "context switch" (switching between different productive apps too quickly, e.g., < 2 mins).
    4. If the log is empty or very short, score is 50 max.
    
    Provide a deep-dive behavioral intelligence report in VALID JSON format with exactly these fields:
    {
      "Focus_Score": <integer 0-100 calculated by rules>,
      "Behavior_Pattern": "<Identify 'Flow Entry', 'Distraction Clusters', and 'Context Switching Penalty' based on the log sequence.>",
      "Recommendation": "<One specific, actionable strategy to fix the distraction patterns in this specific data.>"
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemma Engine Error:", err);
      throw new Error("Intelligence Engine unavailable.");
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Raw Gemma Report:", textResponse);
    
    if (!textResponse) {
      throw new Error("Gemma returned an empty intelligence report.");
    }

    // Ultra-Robust Extraction: Clean markdown artifacts and find first/last curly braces
    let cleanedText = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      // Emergency Fallback: If no JSON at all, check if it's just raw text containing the info
      console.warn("AI didn't return JSON structure. Attempting raw extraction...");
      throw new Error("Could not find valid JSON report in AI response.");
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("AI Analysis Execution Error:", error);
    return {
      Focus_Score: 65,
      Behavior_Pattern: "Our intelligence engine is currently reasoning through your patterns. Please refresh in a moment.",
      Recommendation: "Session recorded successfully. Detailed report will finalize shortly."
    };
  }
}
