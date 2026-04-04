/**
 * useAppTracker — Native AppState Tracker
 * 
 * Uses React Native's AppState API to detect when the user minimizes
 * or switches away from the Focus app during an active session.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { db, rtdb } from '@/lib/firebase';
import { ref, set, push, update } from 'firebase/database';
import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { determineAppRelevance } from '@/lib/aiService';

interface TrackedActivity {
  id: string;
  name: string;
  type: string;
  timestamp: number;
  duration?: number; // ms spent away
}

interface AppTrackerState {
  isTracking: boolean;
  currentApp: string | null;
  activities: TrackedActivity[];
  nudgeVisible: boolean;
  nudgeMessage: string;
}

export function useAppTracker(uid: string | undefined) {
  const [state, setState] = useState<AppTrackerState>({
    isTracking: false,
    currentApp: 'Focus App',
    activities: [],
    nudgeVisible: false,
    nudgeMessage: '',
  });
  
  const taskRef = useRef<string>('');
  const sessionIdRef = useRef<string | null>(null);
  
  // AppState refs
  const appStateRef = useRef(AppState.currentState);
  const backgroundStartTime = useRef<number | null>(null);

  const startTracking = useCallback((task: string, sessionId: string) => {
    taskRef.current = task;
    sessionIdRef.current = sessionId;
    setState(prev => ({ ...prev, isTracking: true, activities: [], currentApp: 'Focus App' }));
  }, []);

  const stopTracking = useCallback(() => {
    setState(prev => ({ ...prev, isTracking: false, currentApp: 'Focus App' }));
  }, []);

  const dismissNudge = useCallback(() => {
    setState(prev => ({ ...prev, nudgeVisible: false, nudgeMessage: '' }));
  }, []);

  const recordDistraction = useCallback(async (timeAwayMs: number) => {
    if (!uid || !state.isTracking || !sessionIdRef.current) return;

    // Convert time away to readable format
    const timeAwaySec = Math.floor(timeAwayMs / 1000);
    const durationStr = timeAwaySec > 60 ? `${Math.floor(timeAwaySec/60)}m ${timeAwaySec%60}s` : `${timeAwaySec}s`;
    
    // We don't know EXACTLY which app they opened (due to OS sandboxing),
    // but leaving the Focus app during a session is inherently a Distraction event.
    const disruptionName = `Phone Distraction (${durationStr})`;
    const activityType = "Distracting";

    // Ask AI for a customized nudge based on their actual task and the fact they got distracted on their phone
    let nudgeMsg = `You were away for ${durationStr}. Time to re-focus!`;
    try {
      const evaluation = await determineAppRelevance(
        taskRef.current, 
        `Left the focus app to check the phone background for ${durationStr}`
      );
      if (evaluation.nudgeMsg) nudgeMsg = evaluation.nudgeMsg;
    } catch(e) {
      console.warn("AI evaluation fallback", e);
    }

    const newActivity: TrackedActivity = {
      id: Date.now().toString(),
      name: disruptionName,
      type: activityType,
      timestamp: Date.now(),
      duration: timeAwayMs,
    };

    // Update LOCAL UI state
    setState(prev => ({
      ...prev,
      currentApp: 'Focus App', // back in the app now
      activities: [newActivity, ...prev.activities],
      nudgeVisible: true, // Trigger Nudge!
      nudgeMessage: nudgeMsg,
    }));

    // Update DATABASE (RTDB & Firestore)
    try {
      const sessionRef = ref(rtdb, `users/${uid}/liveSession`);
      await update(sessionRef, {
        currentApp: { name: 'Focus App', startTime: Date.now() },
      });

      const activityHistoryRef = ref(rtdb, `users/${uid}/liveSession/activities`);
      const newActivityRef = push(activityHistoryRef);
      await set(newActivityRef, {
        name: disruptionName,
        type: activityType,
        timestamp: Date.now(),
      });

      const firestoreActRef = doc(collection(db, 'User', uid, 'Session', sessionIdRef.current, 'Activity'));
      await setDoc(firestoreActRef, {
        App_Name: disruptionName,
        Activity_Type: activityType,
        Start_Time: new Date(Date.now() - timeAwayMs),
        End_Time: new Date(Date.now()),
      });
    } catch(e) {
      console.error("Failed to log distraction event", e);
    }
  }, [uid, state.isTracking]);

  // Hook into AppState
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (!state.isTracking) return;

      // User leaves the app (minimize / switch)
      if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        backgroundStartTime.current = Date.now();
        console.log("App moved to background - user is distracted");
        
        // Optionally update RTDB so web dashboard shows "Phone User is Away"
        if (uid) {
           const sessionRef = ref(rtdb, `users/${uid}/liveSession`);
           update(sessionRef, {
             currentApp: { name: 'Away (Background)', startTime: Date.now() },
           }).catch(console.error);
        }
      }

      // User returns to the app
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        const timeAway = backgroundStartTime.current ? Date.now() - backgroundStartTime.current : 0;
        console.log(`App returned to foreground. Time away: ${timeAway}ms`);
        
        // Only record distraction if they were away for more than 2 seconds (buffer for accidental swipes)
        if (timeAway > 2000) {
           recordDistraction(timeAway);
        } else {
           // Ensure RTDB resets back to Focus App
           if (uid) {
             const sessionRef = ref(rtdb, `users/${uid}/liveSession`);
             update(sessionRef, {
               currentApp: { name: 'Focus App', startTime: Date.now() },
             }).catch(console.error);
           }
        }
        backgroundStartTime.current = null;
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [state.isTracking, recordDistraction, uid]);

  return {
    ...state,
    startTracking,
    stopTracking,
    dismissNudge,
  };
}
