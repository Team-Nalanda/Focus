import { NextResponse } from 'next/server';
import { rtdb } from '@/lib/firebase';
import { ref, set, get } from 'firebase/database';

const API_SECRET = process.env.HARDWARE_API_SECRET || "focusflow-device-secret-2026";

// POST — Lightweight heartbeat from ESP
export async function POST(req: Request) {
  try {
    const token = req.headers.get('x-device-token');
    if (token !== API_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { uid, deviceId, name, firmwareVersion } = body;

    if (!uid || !deviceId) {
      return NextResponse.json({ error: "Missing required fields (uid, deviceId)" }, { status: 400 });
    }

    // Update RTDB device status for real-time dashboard
    const deviceRef = ref(rtdb, `users/${uid}/device`);
    const existing = await get(deviceRef);
    const currentData = existing.val() || {};

    await set(deviceRef, {
      ...currentData,
      id: deviceId,
      name: name || currentData.name || "Focus Device",
      firmwareVersion: firmwareVersion || currentData.firmwareVersion || "1.0.0",
      online: true,
      lastSeen: Date.now(),
    });

    return NextResponse.json({ success: true, message: "Heartbeat received" });
  } catch (error) {
    console.error("Device Heartbeat Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
