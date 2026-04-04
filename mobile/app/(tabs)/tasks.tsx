import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Session, Activity } from '@/types/firestore';
import { Colors, FontSize, BorderRadius, Spacing } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { analyzeSessionActivity } from '@/lib/aiService';

export default function TasksScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionActivities, setSessionActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Realtime listeners
  useEffect(() => {
    if (!user) return;

    const sessionsQ = query(collection(db, 'User', user.uid, 'Session'), orderBy('Start_Time', 'desc'));
    const unsubscribeSessions = onSnapshot(sessionsQ, (snap) => {
      const dbSessions = snap.docs.map(d => ({ id: d.id, ...d.data() } as Session));
      setSessions(dbSessions);

      if (selectedSession?.id) {
        const current = dbSessions.find(s => s.id === selectedSession.id);
        if (current) setSelectedSession(current);
      } else if (dbSessions.length > 0 && !selectedSession) {
        setSelectedSession(dbSessions[0]);
      }
      setLoading(false);
    });

    return () => unsubscribeSessions();
  }, [user]);

  // Load activities when session is selected
  useEffect(() => {
    if (!user || !selectedSession?.id) return;

    const actQuery = query(
      collection(db, 'User', user.uid, 'Session', selectedSession.id, 'Activity'),
      orderBy('Start_Time', 'desc')
    );
    const unsubscribe = onSnapshot(actQuery, (snap) => {
      const acts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
      setSessionActivities(acts);
    });

    // Auto-heal: if completed but no analysis
    if (selectedSession.Status === 'Completed' && !selectedSession.FocusAnalysis && sessionActivities.length > 0) {
      setIsAnalyzing(true);
      const heal = async () => {
        try {
          const analysis = await analyzeSessionActivity(sessionActivities);
          await updateDoc(doc(db, 'User', user.uid, 'Session', selectedSession.id!), {
            Focus_Level: analysis.Focus_Score,
            FocusAnalysis: analysis,
          });
        } catch (e) {
          console.error("Auto-heal failed:", e);
        } finally {
          setIsAnalyzing(false);
        }
      };
      heal();
    }

    return () => unsubscribe();
  }, [user, selectedSession?.id, sessionActivities.length]);

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert('Delete Session', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await deleteDoc(doc(db, 'User', user.uid, 'Session', sessionId));
          setSessions(prev => prev.filter(s => s.id !== sessionId));
          if (selectedSession?.id === sessionId) setSelectedSession(null);
        },
      },
    ]);
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return Colors.accent;
    if (score >= 60) return Colors.warning;
    return Colors.danger;
  };

  const score = selectedSession?.FocusAnalysis?.Focus_Score || selectedSession?.Focus_Level || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Tasks & Sessions</Text>
        <Text style={styles.pageSubtitle}>Review your focus sessions and AI intelligence reports.</Text>
      </View>

      {/* Session List */}
      <View style={styles.sessionList}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>HISTORY</Text>
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Loading sessions...</Text>
        ) : sessions.length === 0 ? (
          <Text style={styles.emptyText}>No focus sessions found yet.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {sessions.map((session, index) => (
              <TouchableOpacity
                key={session.id}
                style={[
                  styles.sessionChip,
                  selectedSession?.id === session.id && styles.sessionChipActive,
                ]}
                onPress={() => setSelectedSession(session)}
                onLongPress={() => session.id && handleDeleteSession(session.id)}
                activeOpacity={0.7}
              >
                <View style={styles.sessionChipHeader}>
                  <Text style={styles.sessionChipTitle}>Session {sessions.length - index}</Text>
                  {session.Status === 'Completed' ? (
                    <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
                  ) : session.Status === 'Active' ? (
                    <View style={styles.activeDot} />
                  ) : (
                    <Ionicons name="close-circle" size={14} color={Colors.danger} />
                  )}
                </View>
                <Text style={styles.sessionChipScore}>
                  Score: {session.FocusAnalysis?.Focus_Score || session.Focus_Level || 0}%
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Selected Session Detail */}
      {selectedSession && (
        <View style={styles.detailSection}>
          {/* Score Header */}
          <View style={styles.scoreHeader}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Focus Score:</Text>
              <Text style={[styles.scoreValue, { color: getScoreColor(score) }]}>{score}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={Colors.textDim} />
              <Text style={styles.metaText}>
                Duration: {(() => {
                  const st = (selectedSession.Start_Time as any)?.toDate?.();
                  const et = (selectedSession.End_Time as any)?.toDate?.();
                  if (st && et) return `${Math.round((et.getTime() - st.getTime()) / 60000)} minutes`;
                  return selectedSession.Status === 'Active' ? 'Ongoing...' : 'Unknown';
                })()}
              </Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={[
                styles.metaText,
                {
                  color: selectedSession.Status === 'Completed' ? Colors.accent :
                    selectedSession.Status === 'Active' ? Colors.accent : Colors.danger,
                },
              ]}>
                {selectedSession.Status || 'In Progress'}
              </Text>
            </View>
          </View>

          {/* AI Intelligence Report */}
          <View style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Ionicons name="sparkles" size={16} color={Colors.accent} />
              <Text style={styles.reportHeaderText}>SESSION INTELLIGENCE REPORT</Text>
            </View>

            <View style={styles.reportGrid}>
              <View style={styles.reportCol}>
                <View style={styles.reportColHeader}>
                  <Ionicons name="fitness" size={16} color={Colors.textDim} />
                  <Text style={styles.reportColTitle}>Behavioral Pattern</Text>
                </View>
                {isAnalyzing || (selectedSession.Status === 'Completed' && !selectedSession.FocusAnalysis) ? (
                  <View style={styles.skeleton}>
                    <View style={[styles.skeletonLine, { width: '100%' }]} />
                    <View style={[styles.skeletonLine, { width: '80%' }]} />
                    <Text style={styles.skeletonHint}>Analyzing Patterns...</Text>
                  </View>
                ) : (
                  <Text style={styles.reportText}>
                    {selectedSession.FocusAnalysis?.Behavior_Pattern ||
                      (selectedSession.Status === 'Active' ? 'Computing live patterns...' : 'Awaiting data sync.')}
                  </Text>
                )}
              </View>

              <View style={styles.reportCol}>
                <View style={styles.reportColHeader}>
                  <Ionicons name="shield-checkmark" size={16} color={Colors.accent} />
                  <Text style={styles.reportColTitle}>Insights</Text>
                </View>
                {isAnalyzing || (selectedSession.Status === 'Completed' && !selectedSession.FocusAnalysis) ? (
                  <View style={styles.skeleton}>
                    <View style={[styles.skeletonLine, { width: '100%' }]} />
                    <View style={[styles.skeletonLine, { width: '60%' }]} />
                    <Text style={styles.skeletonHint}>Scanning Cognition...</Text>
                  </View>
                ) : (
                  <Text style={styles.reportText}>
                    {selectedSession.FocusAnalysis?.Recommendation ||
                      (selectedSession.Status === 'Active' ? 'Advice appears after completion.' : 'Finalizing intelligence...')}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* App Activities */}
          <View style={styles.activitiesSection}>
            <View style={styles.activitiesHeader}>
              <Text style={styles.activitiesTitle}>APPLICATION CONTEXT</Text>
              <View style={styles.syncBadge}>
                <Text style={styles.syncBadgeText}>LIVE SYNC</Text>
              </View>
            </View>

            {sessionActivities.length > 0 ? (
              sessionActivities.map((act) => (
                <View key={act.id} style={styles.activityItem}>
                  <View style={[
                    styles.activityIcon,
                    {
                      backgroundColor: act.Activity_Type === 'Productive' ? Colors.accentMuted :
                        act.Activity_Type === 'Distracting' ? Colors.dangerMuted : 'rgba(255,255,255,0.03)',
                      borderColor: act.Activity_Type === 'Productive' ? Colors.accentBorder :
                        act.Activity_Type === 'Distracting' ? Colors.dangerBorder : Colors.border,
                    },
                  ]}>
                    <Ionicons name="grid-outline" size={16} color={
                      act.Activity_Type === 'Productive' ? Colors.accent :
                        act.Activity_Type === 'Distracting' ? Colors.danger : Colors.textMuted
                    } />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityName}>{act.App_Name}</Text>
                    <Text style={[styles.activityType, {
                      color: act.Activity_Type === 'Productive' ? Colors.accent :
                        act.Activity_Type === 'Distracting' ? Colors.danger : Colors.textMuted,
                    }]}>
                      {act.Activity_Type}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyActivities}>
                <Text style={styles.emptyActivityText}>
                  {selectedSession.Status === 'Active' ? 'Monitoring real-time activity...' : 'No app activity recorded.'}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, paddingTop: 60 },
  pageHeader: { marginBottom: Spacing.xxl },
  pageTitle: { fontSize: 28, fontWeight: '300', color: Colors.text, letterSpacing: -0.5, marginBottom: 4 },
  pageSubtitle: { fontSize: FontSize.md, color: Colors.textMuted, fontWeight: '300' },
  sessionList: { marginBottom: Spacing.xxl },
  sectionHeader: { marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: '600', letterSpacing: 2 },
  loadingText: { color: Colors.textDim, fontSize: FontSize.sm, padding: Spacing.lg },
  emptyText: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic', padding: Spacing.lg },
  horizontalScroll: { marginHorizontal: -Spacing.xl, paddingHorizontal: Spacing.xl },
  sessionChip: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginRight: Spacing.md,
    minWidth: 140,
  },
  sessionChipActive: { borderColor: Colors.text, backgroundColor: 'rgba(255,255,255,0.05)' },
  sessionChipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sessionChipTitle: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.text },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  sessionChipScore: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 0.5, textTransform: 'uppercase' },
  detailSection: { gap: Spacing.lg },
  scoreHeader: { marginBottom: Spacing.sm },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.md, marginBottom: 8 },
  scoreLabel: { fontSize: FontSize.xl, color: Colors.textDim, fontWeight: '300' },
  scoreValue: { fontSize: 48, fontWeight: '300', letterSpacing: -1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: FontSize.sm, color: Colors.textMuted },
  metaDot: { color: Colors.textDim },
  reportCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    overflow: 'hidden',
  },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xxl },
  reportHeaderText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.accent, letterSpacing: 2 },
  reportGrid: { gap: Spacing.xxl },
  reportCol: {},
  reportColHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  reportColTitle: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.text },
  reportText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '300', lineHeight: 22 },
  skeleton: { gap: 8 },
  skeletonLine: { height: 14, backgroundColor: Colors.border, borderRadius: 4 },
  skeletonHint: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 },
  activitiesSection: { gap: Spacing.md },
  activitiesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activitiesTitle: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: '600', letterSpacing: 2 },
  syncBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border },
  syncBadgeText: { fontSize: 9, color: Colors.textMuted, letterSpacing: 0.5 },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: BorderRadius.md,
  },
  activityIcon: { padding: 10, borderRadius: BorderRadius.sm, borderWidth: 1 },
  activityName: { fontSize: FontSize.md, fontWeight: '500', color: Colors.text, marginBottom: 2 },
  activityType: { fontSize: FontSize.xs, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: '600' },
  emptyActivities: {
    padding: Spacing.xxxl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  emptyActivityText: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic' },
});
