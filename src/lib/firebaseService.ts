import { db } from "./firebase";
import { 
  doc, 
  setDoc, 
  collection, 
  updateDoc, 
  serverTimestamp, 
  onSnapshot,
  getDoc,
  Unsubscribe
} from "firebase/firestore";
import { 
  User, 
  Settings, 
  Session 
} from "@/types/firestore";

export class DatabaseService {
  /**
   * Initializes a user profile on signup using setDoc.
   */
  static async initializeUserProfile(
    uid: string, 
    data: { Email: string; Name: string; Age?: number; Role?: string }
  ): Promise<void> {
    const userRef = doc(db, "User", uid);
    
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) return;

    const newUser: User = {
      Email: data.Email,
      Name: data.Name,
      Role: data.Role || "Standard",
      Age: data.Age || 18,
      Settings: {
        Notification_Preference: "All",
        Sensitivity_Level: "Medium"
      },
      Created_At: serverTimestamp(),
      Updated_At: serverTimestamp(),
    };

    await setDoc(userRef, newUser);
  }

  /**
   * Records an app usage activity.
   */
  static async createActivity(uid: string, activity: Partial<import("@/types/firestore").Activity>): Promise<void> {
    const actRef = doc(collection(db, "User", uid, "Activity"));
    await setDoc(actRef, {
      ...activity,
      Start_Time: activity.Start_Time || serverTimestamp(),
    });
  }

  /**
   * Adds an academic anchor goal.
   */
  static async addAnchorGoal(uid: string, goal: { Goal_Description: string; Priority_Level: string }): Promise<void> {
    const goalRef = doc(collection(db, "User", uid, "AnchorGoal"));
    await setDoc(goalRef, {
      ...goal,
      Created_At: serverTimestamp(),
      Updated_At: serverTimestamp(),
    });
  }

  /**
   * Registers a device.
   */
  static async registerDevice(uid: string, device: { Device_Type: string; Operating_System: string }): Promise<void> {
    const deviceRef = doc(collection(db, "User", uid, "Device"));
    await setDoc(deviceRef, {
      ...device,
      Created_At: serverTimestamp(),
      Updated_At: serverTimestamp(),
    });
  }

  /**
   * Starts a focus session for a user.
   */
  static async startSession(uid: string): Promise<string> {
    const sessionRef = doc(collection(db, "User", uid, "Session"));
    
    const newSession: Session = {
      Status: "Active",
      Focus_Level: 100,
      Start_Time: serverTimestamp(),
      BreakSuggestion: [],
      Created_At: serverTimestamp(),
      Updated_At: serverTimestamp(),
    };

    await setDoc(sessionRef, newSession);
    return sessionRef.id;
  }

  /**
   * Updates an existing session's status.
   */
  static async updateSessionStatus(uid: string, sessionId: string, status: "Active" | "Paused" | "Abandoned"): Promise<void> {
    const sessionRef = doc(db, "User", uid, "Session", sessionId);
    await updateDoc(sessionRef, {
      Status: status,
      Updated_At: serverTimestamp(),
    });
  }

  /**
   * Ends a session, recording the end time and final status.
   */
  static async endSession(uid: string, sessionId: string): Promise<void> {
    const sessionRef = doc(db, "User", uid, "Session", sessionId);
    await updateDoc(sessionRef, {
      Status: "Completed",
      End_Time: serverTimestamp(),
      Updated_At: serverTimestamp(),
    });
  }

  /**
   * Uses real-time onSnapshot to listen for when the AI finishes processing a session's focus data
   * or when real-time break suggestions are pushed.
   */
  static listenToSessionAnalysis(
    uid: string, 
    sessionId: string, 
    onData: (session: Session) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    const sessionRef = doc(db, "User", uid, "Session", sessionId);
    
    return onSnapshot(sessionRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as Session;
        data.id = docSnapshot.id;
        onData(data);
      } else {
         onError(new Error("Session document does not exist."));
      }
    }, (error) => {
      onError(error);
    });
  }
}
