import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { useAuth } from '@/components/AuthProvider';
import { db, rtdb } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, onValue, set } from 'firebase/database';
import { Session } from '@/types/firestore';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Colors, FontSize, BorderRadius, Spacing } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { analyzeSessionActivity } from '@/lib/aiService';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [chartData, setChartData] = useState<{ labels: string[]; scores: number[]; durations: number[] }>({
    labels: [], scores: [], durations: [],
  });
  const [isSessionLive, setIsSessionLive] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // RTDB Monitor for Live Session State
    const liveRef = ref(rtdb, `users/${user.uid}/liveSession`);
    const unsubscribeRtdb = onValue(liveRef, (snapshot) => {
      const data = snapshot.val();
      setIsSessionLive(!!data?.active);
      setActiveSessionId(data?.firestoreSessionId || null);
    });

    // Fetch sessions from Firestore
    async function fetchData() {
      try {
        const q = query(
          collection(db, 'User', user!.uid, 'Session'),
          orderBy('Start_Time', 'desc'),
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Session,
        );
        setSessions(data);

        // Process chart data (last 7 days)
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const labels: string[] = [];
        const scores: number[] = [];
        const durations: number[] = [];

        for (let i = 6; i >= 0; i--) {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() - i);
          targetDate.setHours(0, 0, 0, 0);

          const daySessions = data.filter((s) => {
            const t = s.Start_Time as any;
            const date = t?.toDate ? t.toDate() : new Date();
            return (
              date.getDate() === targetDate.getDate() &&
              date.getMonth() === targetDate.getMonth() &&
              date.getFullYear() === targetDate.getFullYear()
            );
          });

          const completedDaySessions = daySessions.filter(s => s.Status === 'Completed');
          let dayScore = 0;
          if (completedDaySessions.length > 0) {
            dayScore = Math.round(
              completedDaySessions.reduce(
                (acc, s) => acc + (s.FocusAnalysis?.Focus_Score || s.Focus_Level || 0), 0,
              ) / completedDaySessions.length,
            );
          }

          let dayDuration = 0;
          daySessions.forEach(s => {
            const st = (s.Start_Time as any)?.toDate?.() || new Date();
            const et = (s.End_Time as any)?.toDate?.() || null;
            if (et) dayDuration += (et.getTime() - st.getTime()) / (1000 * 60 * 60);
          });

          labels.push(days[targetDate.getDay()]);
          scores.push(dayScore);
          durations.push(parseFloat(dayDuration.toFixed(1)));
        }
        setChartData({ labels, scores, durations });
      } catch (error) {
        console.error('Error fetching sessions:', error);
      } finally {
        setLoadingDb(false);
      }
    }
    fetchData();

    return () => unsubscribeRtdb();
  }, [user]);

  const handleStartSession = async () => {
    if (!user) return;
    setStartingSession(true);

    try {
      // 1. Create Firestore Session
      const sessionRef = await addDoc(
        collection(db, 'User', user.uid, 'Session'),
        {
          Status: 'Active',
          Focus_Level: 0,
          Start_Time: serverTimestamp(),
          Created_At: serverTimestamp(),
          Updated_At: serverTimestamp(),
          BreakSuggestion: [],
        },
      );

      // 2. Initialize RTDB for realtime tracking
      const rtdbSessionRef = ref(rtdb, `users/${user.uid}/liveSession`);
      await set(rtdbSessionRef, {
        active: true,
        firestoreSessionId: sessionRef.id,
        startTime: Date.now(),
        currentApp: { name: 'Focus Starting...', startTime: Date.now() },
        activities: {},
      });

      setStartingSession(false);
      router.push('/activity');
    } catch (e) {
      console.error('Start session error:', e);
      setStartingSession(false);
    }
  };

  const handleStopSession = async () => {
    if (!user || !activeSessionId) return;
    setStartingSession(true);

    try {
      // 1. Finalize Firestore
      const sessionDocRef = doc(db, 'User', user.uid, 'Session', activeSessionId);
      await updateDoc(sessionDocRef, {
        Status: 'Completed',
        End_Time: serverTimestamp(),
        Updated_At: serverTimestamp(),
      });

      // 2. Analyze
      const activitiesSnapshot = await getDocs(
        collection(db, 'User', user.uid, 'Session', activeSessionId, 'Activity')
      );
      const activities = activitiesSnapshot.docs.map(d => d.data());
      if (activities.length > 0) {
        const analysis = await analyzeSessionActivity(activities);
        await updateDoc(sessionDocRef, {
          Focus_Level: analysis.Focus_Score,
          FocusAnalysis: analysis,
        });
      }

      // 3. Clear RTDB
      const liveRef = ref(rtdb, `users/${user.uid}/liveSession`);
      await set(liveRef, { active: false });

      setStartingSession(false);
    } catch (e) {
      console.error('Stop session error:', e);
      setStartingSession(false);
    }
  };

  const completedSessions = sessions.filter((s) => s.Status === 'Completed');

  const totalDeepWorkHours = completedSessions.reduce((acc, s) => {
    const st = (s.Start_Time as any)?.toDate?.() || new Date();
    const et = (s.End_Time as any)?.toDate?.() || null;
    return acc + (et ? (et.getTime() - st.getTime()) / (1000 * 60 * 60) : 0);
  }, 0);

  const deepWorkDisplay = `${Math.floor(totalDeepWorkHours)}h ${Math.round((totalDeepWorkHours % 1) * 60)}m`;

  const avgFocusScore =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce(
            (acc, s) => acc + (s.FocusAnalysis?.Focus_Score || s.Focus_Level || 0), 0,
          ) / completedSessions.length,
        )
      : 0;

  const stats = [
    { label: 'Avg Focus Score', value: isNaN(avgFocusScore) ? '-' : `${avgFocusScore}`, icon: 'analytics-outline' as const },
    { label: 'Deep Work Time', value: deepWorkDisplay, icon: 'time-outline' as const },
    { label: 'Completed', value: `${completedSessions.length}`, icon: 'checkmark-circle-outline' as const },
    { label: 'Total Sessions', value: `${sessions.length}`, icon: 'flash-outline' as const },
  ];

  const chartConfig = {
    backgroundGradientFrom: Colors.surface,
    backgroundGradientTo: Colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: () => Colors.textMuted,
    propsForBackgroundLines: { stroke: Colors.border, strokeDasharray: '3,3' },
    propsForDots: { r: '3', strokeWidth: '1', stroke: Colors.text },
    fillShadowGradientFrom: Colors.text,
    fillShadowGradientTo: 'transparent',
    fillShadowGradientFromOpacity: 0.15,
    fillShadowGradientToOpacity: 0,
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={require('../../assets/images/logo-circle.jpg')} style={{ width: 44, height: 44, borderRadius: 22 }} />
          <View>
            <Text style={styles.title}>Overview</Text>
            <Text style={styles.subtitle}>
              Welcome back, <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
            </Text>
          </View>
        </View>

        {isSessionLive ? (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStopSession}
            disabled={startingSession}
            activeOpacity={0.8}
          >
            {startingSession ? (
              <ActivityIndicator size="small" color={Colors.danger} />
            ) : (
              <View style={styles.stopDot} />
            )}
            <Text style={styles.stopButtonText}>
              {startingSession ? 'Analyzing...' : 'Stop Session'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartSession}
            disabled={startingSession}
            activeOpacity={0.8}
          >
            {startingSession ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="play" size={16} color="#000" />
            )}
            <Text style={styles.startButtonText}>
              {startingSession ? 'Starting...' : 'Start Session'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {stats.map((stat, i) => (
          <View key={i} style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Ionicons name={stat.icon} size={16} color={Colors.textDim} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
          </View>
        ))}
      </View>

      {/* Focus Trend Chart */}
      {chartData.labels.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Focus Trend (Last 7 Days)</Text>
          <LineChart
            data={{
              labels: chartData.labels,
              datasets: [{ data: chartData.scores.some(s => s > 0) ? chartData.scores : [0, 0, 0, 0, 0, 0, 0] }],
            }}
            width={screenWidth - 64}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withInnerLines={true}
            withOuterLines={false}
          />
        </View>
      )}

      {/* Activity Duration Chart */}
      {chartData.labels.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Activity Duration (Hrs)</Text>
          <BarChart
            data={{
              labels: chartData.labels,
              datasets: [{ data: chartData.durations.some(d => d > 0) ? chartData.durations : [0, 0, 0, 0, 0, 0, 0] }],
            }}
            width={screenWidth - 64}
            height={200}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(68, 68, 68, ${opacity})`,
              barPercentage: 0.6,
            }}
            style={styles.chart}
            withInnerLines={true}
            showValuesOnTopOfBars={false}
            yAxisLabel=""
            yAxisSuffix=""
          />
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xl,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: 28,
    fontWeight: '300',
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontWeight: '300',
  },
  userName: {
    color: Colors.text,
    fontWeight: '500',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: Colors.text,
    borderRadius: BorderRadius.md,
  },
  startButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: FontSize.sm,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: Colors.dangerMuted,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    borderRadius: BorderRadius.md,
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: Colors.danger,
  },
  stopButtonText: {
    color: Colors.danger,
    fontWeight: '600',
    fontSize: FontSize.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    height: 110,
    justifyContent: 'space-between',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '300',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  chartCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  chartTitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    letterSpacing: 0.3,
    marginBottom: Spacing.lg,
  },
  chart: {
    borderRadius: BorderRadius.md,
    marginLeft: -Spacing.lg,
  },
});
