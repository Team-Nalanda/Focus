import { NextResponse } from 'next/server';
import { db, rtdb } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, set } from 'firebase/database';

const API_SECRET = process.env.HARDWARE_API_SECRET || "focusflow-device-secret-2026";

function validateToken(req: Request): boolean {
  const token = req.headers.get('x-device-token');
  return token === API_SECRET;
}

// GET — ESP polls this to check for active session
export async function GET(req: Request) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ error: "Missing uid parameter" }, { status: 400 });
    }

    const sessionsRef = collection(db, "User", uid, "Session");
    const q = query(sessionsRef, where("Status", "==", "Active"));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const activeSessionDoc = querySnapshot.docs[0];
      const sessionData = activeSessionDoc.data();
      return NextResponse.json({
        active: true,
        sessionId: activeSessionDoc.id,
        task: sessionData.Task || null,
      });
    }

    return NextResponse.json({ active: false });
  } catch (error) {
    console.error("Hardware Polling API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST — ESP pushes sensor data + computed suitability score
export async function POST(req: Request) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { uid, sessionId, environment, deviceId } = body;

    if (!uid || !environment) {
      return NextResponse.json({ error: "Missing required fields (uid, environment)" }, { status: 400 });
    }

    const envData = {
      Temperature: environment.temperature,
      Humidity: environment.humidity,
      Light_Level: environment.lightLevel,
      Noise_Level: environment.noiseLevel,
      Focus_Suitability: environment.focusSuitability,
      Suitability_Score: environment.suitabilityScore,
      Timestamp: serverTimestamp(),
    };

    // 1. Write environment data to Firestore Session document (only if session active)
    if (sessionId) {
      const sessionRef = doc(db, "User", uid, "Session", sessionId);
      await updateDoc(sessionRef, {
        Environment: envData,
        Updated_At: serverTimestamp(),
      });

      // 2. Mirror to RTDB for real-time dashboard updates
      const rtdbEnvRef = ref(rtdb, `users/${uid}/liveSession/environment`);
      await set(rtdbEnvRef, {
        temperature: environment.temperature,
        humidity: environment.humidity,
        lightLevel: environment.lightLevel,
        noiseLevel: environment.noiseLevel,
        focusSuitability: environment.focusSuitability,
        suitabilityScore: environment.suitabilityScore,
        timestamp: Date.now(),
      });
    }

    // 3. Update device heartbeat in RTDB
    if (deviceId) {
      const rtdbDeviceRef = ref(rtdb, `users/${uid}/device`);
      await set(rtdbDeviceRef, {
        id: deviceId,
        online: true,
        lastSeen: Date.now(),
        lastEnvironment: {
          temperature: environment.temperature,
          humidity: environment.humidity,
          lightLevel: environment.lightLevel,
          noiseLevel: environment.noiseLevel,
          suitabilityScore: environment.suitabilityScore,
          focusSuitability: environment.focusSuitability,
        },
      });
    }

    return NextResponse.json({ success: true, message: "Environment data synchronized" });
  } catch (error) {
    console.error("Hardware Data Push API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
