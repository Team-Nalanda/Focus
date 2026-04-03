import { NextResponse } from 'next/server';
import { analyzeSessionActivity, getLiveFocusTip } from '@/lib/aiService';

export async function POST(req: Request) {
  try {
    const { activities, type } = await req.json();

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      if (type === 'tip') return NextResponse.json({ tip: "Ready to focus?" });
      return NextResponse.json({
        Focus_Score: 50,
        Behavior_Pattern: "No activity data recorded.",
        Recommendation: "Ensure the extension is active."
      });
    }

    if (type === 'tip') {
      const tip = await getLiveFocusTip(activities);
      return NextResponse.json({ tip });
    }

    const analysis = await analyzeSessionActivity(activities);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("API Analyze Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
