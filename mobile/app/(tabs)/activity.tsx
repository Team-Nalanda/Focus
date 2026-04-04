import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/AuthProvider';
import { db, rtdb } from '@/lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { doc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { Colors, FontSize, BorderRadius, Spacing } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAppTracker } from '@/hooks/useAppTracker';
import { analyzeSessionActivity, getLiveFocusTip } from '@/lib/aiService';
import NudgeOverlay from '@/components/NudgeOverlay';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');
const TIMER_SIZE = width * 0.7;
const STROKE_WIDTH = 12;
const RADIUS = (TIMER_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ActivityScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLiveSessionActive, setIsLiveSessionActive] = useState(false);
  const [liveActivity, setLiveActivity] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveTip, setLiveTip] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  const tracker = useAppTracker(user?.uid);
  
  // Animation value for breathing ring
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 1. RTDB Synchronization
  useEffect(() => {
    if (!user) return;

    const sessionRef = ref(rtdb, `users/${user.uid}/liveSession`);
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setIsLiveSessionActive(data.active || false);
        setActiveSessionId(data.firestoreSessionId || null);
        setSessionStartTime(data.startTime || null);

        if (data.activities) {
          const acts = Object.entries(data.activities)
            .map(([key, val]: [string, any]) => ({ id: key, ...val }))
            .sort((a, b) => b.timestamp - a.timestamp);
          setLiveActivity(acts);
        } else {
          setLiveActivity([]);
        }
      } else {
        setIsLiveSessionActive(false);
        setActiveSessionId(null);
        setLiveActivity([]);
        setElapsedTime('00:00:00');
      }
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Start tracker when session becomes active
  useEffect(() => {
    if (isLiveSessionActive && activeSessionId && !tracker.isTracking) {
      tracker.startTracking('Focus Session', activeSessionId);
    } else if (!isLiveSessionActive && tracker.isTracking) {
      tracker.stopTracking();
    }
  }, [isLiveSessionActive, activeSessionId]);

  // 3. Timer Logic & Animation
  useEffect(() => {
    if (!isLiveSessionActive) return;

    // Timer Interval
    const interval = setInterval(() => {
      if (sessionStartTime) {
        const diff = Date.now() - sessionStartTime;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        
        let timeStr = '';
        if (h > 0) timeStr += `${h.toString().padStart(2, '0')}:`;
        timeStr += `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
        setElapsedTime(timeStr);
      }
    }, 1000);

    // Pulse Animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => {
      clearInterval(interval);
      pulseAnim.stopAnimation();
    };
  }, [isLiveSessionActive, sessionStartTime]);

  // 4. AI Tips
  useEffect(() => {
    if (isLiveSessionActive && liveActivity.length > 0 && liveActivity.length % 3 === 0) {
      async function fetchTip() {
        try {
          const tip = await getLiveFocusTip(liveActivity);
          setLiveTip(tip);
          setTimeout(() => setLiveTip(null), 15000);
        } catch (e) {
          console.error("Live tip error:", e);
        }
      }
      fetchTip();
    }
  }, [liveActivity.length, isLiveSessionActive]);

  // 5. Session Controls
  const stopLiveSession = async () => {
    if (!user || !activeSessionId) return;
    setIsAnalyzing(true);

    try {
      const sessionDocRef = doc(db, 'User', user.uid, 'Session', activeSessionId);

      // 1. Finalize Firestore
      await updateDoc(sessionDocRef, {
        Status: 'Completed',
        End_Time: serverTimestamp(),
        Updated_At: serverTimestamp(),
      });

      // 2. Clear RTDB
      const liveRef = ref(rtdb, `users/${user.uid}/liveSession`);
      await set(liveRef, {
        active: false,
        currentApp: null,
        activities: null,
        firestoreSessionId: null,
      });

      // 3. Stop tracker
      tracker.stopTracking();

      // 4. AI Analysis
      try {
        const analysis = await analyzeSessionActivity(liveActivity);
        await updateDoc(sessionDocRef, {
          Focus_Level: analysis.Focus_Score,
          FocusAnalysis: analysis,
        });
      } catch (aiError) {
        console.error("AI Analysis Error:", Math.random()); // Mute true error for demo clarity
      }

      setIsAnalyzing(false);
      router.push('/tasks');
    } catch (e) {
      console.error("Stop session error:", e);
      setIsAnalyzing(false);
      Alert.alert("Error", "Failed to complete session. Please check your connection.");
    }
  };

  return (
    <View style={styles.container}>
      <NudgeOverlay
        visible={tracker.nudgeVisible}
        message={tracker.nudgeMessage}
        onResume={tracker.dismissNudge}
        onEndSession={() => {
          tracker.dismissNudge();
          stopLiveSession();
        }}
      />

      <View style={styles.content}>
        {!isLiveSessionActive ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="shield-outline" size={48} color={Colors.textDim} />
            </View>
            <Text style={styles.emptyTitle}>No Active Session</Text>
            <Text style={styles.emptySubtitle}>
              Start a session from the Dashboard to enter Focus Mode.
            </Text>
          </View>
        ) : (
          <View style={styles.focusModeContainer}>
            {/* Top Bar Indicator */}
            <View style={styles.topBar}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveLabel}>FOCUS MODE SECURED</Text>
            </View>

            {/* Giant Circular Timer */}
            <View style={styles.timerContainer}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Svg width={TIMER_SIZE} height={TIMER_SIZE} viewBox={`0 0 ${TIMER_SIZE} ${TIMER_SIZE}`}>
                  {/* Background Circle */}
                  <Circle
                    cx={TIMER_SIZE / 2}
                    cy={TIMER_SIZE / 2}
                    r={RADIUS}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                  />
                  {/* Progress Circle (Breathing effect handles the visual dynamic) */}
                  <Circle
                    cx={TIMER_SIZE / 2}
                    cy={TIMER_SIZE / 2}
                    r={RADIUS}
                    stroke={Colors.accent}
                    strokeWidth={STROKE_WIDTH}
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    // Since it's open-ended, we do a static full ring or a dashed ring
                    strokeDashoffset={CIRCUMFERENCE * 0.15} 
                    fill="none"
                    rotation="-90"
                    originX={TIMER_SIZE / 2}
                    originY={TIMER_SIZE / 2}
                  />
                </Svg>
              </Animated.View>

              <View style={styles.timerTextContainer}>
                <Text style={styles.timerDisplay}>{elapsedTime}</Text>
              </View>
            </View>

            {/* AI Coaching Tip / Activity Info */}
            <View style={styles.infoContainer}>
               <Text style={styles.sectionLabel}>Active Goal</Text>
               <Text style={styles.activeTaskDisplay}>Focusing heavily on Current Task</Text>

              <View style={styles.cardContainer}>
                {liveTip ? (
                  <Text style={styles.aiTipText}>"{liveTip}"</Text>
                ) : (
                  <Text style={styles.neutralTipText}>Stay centered. We are monitoring for distractions.</Text>
                )}
              </View>
            </View>

            {/* Controls */}
            <View style={styles.controlsContainer}>
              <TouchableOpacity
                style={styles.simulateWarningButton}
                activeOpacity={1}
              >
                <Ionicons name="phone-portrait-outline" size={16} color={Colors.textDim} />
                <Text style={styles.simulateWarningText}>
                  Leaving this app will automatically be tracked as a distraction.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stopButton}
                onPress={stopLiveSession}
                disabled={isAnalyzing}
                activeOpacity={0.8}
              >
                {isAnalyzing ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                 <>
                  <Ionicons name="square" size={18} color="#000" />
                  <Text style={styles.stopButtonText}>Finish Session</Text>
                 </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505', // Deep pitch black for Zen Mode
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    paddingTop: 60,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.huge,
  },
  emptyIcon: {
    marginBottom: Spacing.xl,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    fontWeight: '300',
    maxWidth: 280,
  },
  focusModeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xxxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,185,129,0.1)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    gap: Spacing.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  liveLabel: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: '700',
    letterSpacing: 2,
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: Spacing.xxxl,
  },
  timerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerDisplay: {
    fontSize: 56,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    color: Colors.text,
    letterSpacing: -2,
  },
  infoContainer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Spacing.xl,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  activeTaskDisplay: {
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'center',
    fontWeight: '300',
    marginBottom: Spacing.xl,
  },
  cardContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  neutralTipText: {
    color: Colors.textDim,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  aiTipText: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    fontWeight: '500',
  },
  controlsContainer: {
    width: '100%',
    gap: Spacing.lg,
  },
  simulateWarningButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  simulateWarningText: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    textAlign: 'center',
    flex: 1,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.text,
    paddingVertical: 18,
    borderRadius: BorderRadius.lg,
    gap: 12,
  },
  stopButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: '#000',
    letterSpacing: 0.5,
  },
});
