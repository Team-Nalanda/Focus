export async function getLiveFocusTip(activities: any[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Focus on the task at hand.";

  const model = "gemini-1.5-flash-latest";
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

  const model = "gemini-1.5-flash-latest";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Format activities for the prompt
  const activityLog = activities
    .map((a) => `${a.name || a.App_Name} [${a.Activity_Type || 'Neutral'}]`)
    .join(" -> ");

  const prompt = `
    Analyze this focus session: [${activityLog}]
    Respond with ONLY a VALID JSON object with: 
    {
      "Focus_Score": <0-100>,
      "Behavior_Pattern": "<Advanced psychological analysis: Identify 'Flow Entry' and 'Distraction Clusters'.>",
      "Recommendation": "<One specific, actionable strategy.>"
    }
    No extra text, no markdown.
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
      console.error("Gemini Engine Error:", err);
      throw new Error("Intelligence Engine unavailable.");
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResponse) {
      throw new Error("Gemini returned an empty intelligence report.");
    }

    // Robust parsing: strip potential markdown code blocks
    const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("AI Analysis Execution Error:", error);
    return {
      Focus_Score: 70,
      Behavior_Pattern: "Data recording completed. Automatic behavioral analysis is partially unavailable.",
      Recommendation: "Keep maintaining steady blocks of deep work for accurate future reports."
    };
  }
}
