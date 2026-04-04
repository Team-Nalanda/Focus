import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const API_SECRET = process.env.HARDWARE_API_SECRET || "focusflow-device-secret-2026";

// POST — Register or update a device
export async function POST(req: Request) {
  try {
    const token = req.headers.get('x-device-token');
    if (token !== API_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { uid, deviceId, name, firmwareVersion, deviceType, operatingSystem } = body;

    if (!uid || !deviceId) {
      return NextResponse.json({ error: "Missing required fields (uid, deviceId)" }, { status: 400 });
    }

    const deviceRef = doc(db, "User", uid, "Device", deviceId);
    const existing = await getDoc(deviceRef);

    if (existing.exists()) {
      // Update existing device
      await setDoc(deviceRef, {
        ...existing.data(),
        Device_Name: name || existing.data().Device_Name || "Focus Device",
        Firmware_Version: firmwareVersion || existing.data().Firmware_Version,
        Status: "Online",
        Last_Seen: serverTimestamp(),
        Updated_At: serverTimestamp(),
      });
    } else {
      // Register new device
      await setDoc(deviceRef, {
        Device_Type: deviceType || "ESP8266",
        Operating_System: operatingSystem || "Arduino",
        Device_Name: name || "Focus Desk Monitor",
        Firmware_Version: firmwareVersion || "1.0.0",
        Status: "Online",
        Last_Seen: serverTimestamp(),
        Created_At: serverTimestamp(),
        Updated_At: serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      message: existing.exists() ? "Device updated" : "Device registered",
      deviceId: deviceId,
    });
  } catch (error) {
    console.error("Device Registration Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
