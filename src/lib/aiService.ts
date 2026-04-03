export async function getLiveFocusTip(activities: any[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Focus on the task at hand.";

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemma-2-9b-it:generateContent?key=${apiKey}`;

  // Use only the last 3-5 activities for a "mini-insight"
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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemma-2-9b-it:generateContent?key=${apiKey}`;

  // Format activities for the prompt
  const activityLog = activities
    .map((a) => `${a.name || a.App_Name} (${a.Activity_Type || 'Unknown'})`)
    .join(", ");

  const prompt = `
    You are a high-performance focus coach for software engineers and knowledge workers. 
    Analyze the following chronological sequence of application usage from a user's focus session:
    [${activityLog}]

    Based on this data, provide a structured focus report in VALID JSON format with exactly these fields:
    {
      "Focus_Score": <number between 0 and 100 assessing their overall flow and productivity>,
      "Behavior_Pattern": "<Evaluate their flow entry. Mention context switches and the ratio of productive vs distracting apps.>",
      "Recommendation": "<One specific, high-leverage piece of advice to improve their focus (e.g. 'Your context switching to Slack after 15 mins suggests you should set notification snoozing during deep work blocks.')>"
    }

    Return ONLY the JSON object. Be concise but insightful.
  `;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemma API Error:", err);
      throw new Error("Failed to communicate with Gemma AI.");
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResponse) {
      throw new Error("Empty response from Gemma AI.");
    }

    return JSON.parse(textResponse);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    // Return a fallback analysis if AI fails
    return {
      Focus_Score: 70,
      Behavior_Pattern: "Data recording completed. Automatic analysis partially unavailable.",
      Recommendation: "Keep tracking your sessions for more accurate insights."
    };
  }
}
