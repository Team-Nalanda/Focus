import { FieldValue, Timestamp } from "firebase/firestore";

// Helper type for standardizing timestamps
export type FirestoreDate = Timestamp | FieldValue | Date;

export interface Settings {
  Notification_Preference: "All" | "Important" | "None" | string;
  Sensitivity_Level: "Low" | "Medium" | "High" | "Strict" | string;
}

export interface User {
  id?: string; // Firebase Auth UID
  Name: string;
  Email: string;
  Age?: number;
  Role: "Standard" | "Admin" | string;
  Settings: Settings;
  Created_At: FirestoreDate;
  Updated_At: FirestoreDate;
}

export interface AnchorGoal {
  id?: string;
  Goal_Description: string;
  Priority_Level: "Low" | "Medium" | "High" | string;
  Created_At: FirestoreDate;
  Updated_At: FirestoreDate;
}

export interface Device {
  id?: string;
  Device_Type: string;
  Operating_System: string;
  Created_At: FirestoreDate;
  Updated_At: FirestoreDate;
}

export interface FocusAnalysis {
  Focus_Score: number; 
  Behavior_Pattern?: string; 
  Recommendation?: string;
  Analyzed_At: FirestoreDate;
}

export interface BreakSuggestion {
  id: string; // Typically a UUID wrapper for array management
  Suggestion_Type: "Mental" | "Physical" | "Hydration" | "Eye-rest" | string;
  Message: string;
  Time_Suggested: FirestoreDate;
  Is_Dismissed: boolean;
}

export interface Session {
  id?: string;
  Status: "Active" | "Paused" | "Completed" | "Abandoned" | string;
  Focus_Level: number; // e.g. out of 100
  Start_Time: FirestoreDate;
  End_Time?: FirestoreDate;
  
  FocusAnalysis?: FocusAnalysis; // Embedded map for AI data
  BreakSuggestion: BreakSuggestion[]; // Array to capture real-time productivity alerts
  
  Created_At: FirestoreDate;
  Updated_At: FirestoreDate;
}

export interface Activity {
  id?: string;
  Session_ID?: string; // Link to a specific Session
  App_Name: string;
  Activity_Type: "Productive" | "Distracting" | "Neutral" | string;
  Start_Time: FirestoreDate;
  End_Time?: FirestoreDate;
}
