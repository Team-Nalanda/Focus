import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Session, Activity } from '@/types/firestore';
import { Colors, FontSize, BorderRadius, Spacing } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user } = useAuth();

  const [profileStats, setProfileStats] = useState({
    totalFocusHours: 0,
    peakDistractionApp: '-',
    averageFocusTime: '0m',
    topFocusTime: '-',
    distractionResistance: 0,
  });

  useEffect(() => {
    async function loadProfileMetrics() {
      if (!user) return;
      try {
        const fetchSessions = await getDocs(collection(db, 'User', user.uid, 'Session'));
        const fetchActivities = await getDocs(collection(db, 'User', user.uid, 'Activity'));

        const sessions = fetchSessions.docs.map(d => d.data() as Session);
        const activities = fetchActivities.docs.map(d => d.data() as Activity);

        // 1. Total Focus Hours
        let totalMs = 0;
        sessions.forEach(s => {
          const st = (s.Start_Time as any)?.toDate?.() || new Date();
          const et = (s.End_Time as any)?.toDate?.() || null;
          if (et) totalMs += (et.getTime() - st.getTime());
        });
        const totalHours = Math.floor(totalMs / 3600000);

        // 2. Average focus time
        const avgMs = sessions.length > 0 ? Math.round(totalMs / sessions.length) : 0;
        const avgFocusMins = Math.floor(avgMs / 60000);

        // 3. Peak distraction app
        const distApps: Record<string, number> = {};
        let topDistApp = 'None Detected';
        let maxDist = 0;
        activities.filter(a => a.Activity_Type === 'Distracting').forEach(a => {
          distApps[a.App_Name] = (distApps[a.App_Name] || 0) + 1;
          if (distApps[a.App_Name] > maxDist) {
            maxDist = distApps[a.App_Name];
            topDistApp = a.App_Name;
          }
        });

        // 4. Distraction Resistance
        const totalActs = activities.length;
        const distCount = activities.filter(a => a.Activity_Type === 'Distracting').length;
        const resistance = totalActs > 0 ? Math.round(((totalActs - distCount) / totalActs) * 100) : 100;

        setProfileStats({
          totalFocusHours: totalHours,
          peakDistractionApp: topDistApp,
          averageFocusTime: `${avgFocusMins}m`,
          topFocusTime: 'Morning',
          distractionResistance: resistance,
        });
      } catch (error) {
        console.error('Failed to load profile metrics', error);
      }
    }
    loadProfileMetrics();
  }, [user]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Profile</Text>
        <Text style={styles.pageSubtitle}>
          Your focus psychology profile and performance metrics.
        </Text>
      </View>

      {/* Identity Card */}
      <View style={styles.identityCard}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={36} color={Colors.textDim} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.displayName}>{user?.displayName || 'User'}</Text>
          <View style={styles.emailRow}>
            <Ionicons name="mail-outline" size={13} color={Colors.textDim} />
            <Text style={styles.emailText}>{user?.email || 'user@example.com'}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Ionicons name="diamond-outline" size={12} color={Colors.warning} />
            <Text style={styles.levelText}>PRO LEVEL</Text>
          </View>
        </View>
      </View>

      {/* Focus Strengths */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flame" size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>FOCUS STRENGTHS</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Peak Flow State</Text>
          <Text style={styles.metricValue}>{profileStats.topFocusTime}</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: '80%', backgroundColor: Colors.accent }]} />
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Average Focus Duration</Text>
          <Text style={styles.metricValue}>{profileStats.averageFocusTime} per session</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: '60%', backgroundColor: Colors.accent }]} />
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Total Focus Logged</Text>
          <Text style={styles.metricValue}>{profileStats.totalFocusHours} Hrs</Text>
        </View>
      </View>

      {/* Distraction Profile */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-half" size={18} color={Colors.danger} />
          <Text style={styles.sectionTitle}>DISTRACTION PROFILE</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Distraction Resistance</Text>
          <Text style={styles.metricValue}>{profileStats.distractionResistance}%</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${profileStats.distractionResistance}%`,
                backgroundColor: Colors.danger,
              },
            ]}
          />
        </View>

        <Text style={styles.disruptorLabel}>Major Disrupter Context</Text>
        <View style={styles.disruptorCard}>
          <Text style={styles.disruptorName}>{profileStats.peakDistractionApp}</Text>
          <Text style={styles.disruptorHint}>Primary source of focus session interruptions.</Text>
        </View>
      </View>

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
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceHover,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: { fontSize: FontSize.xl, fontWeight: '500', color: Colors.text, letterSpacing: -0.3, marginBottom: 4 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  emailText: { fontSize: FontSize.sm, color: Colors.textMuted },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  levelText: { fontSize: 10, fontWeight: '600', color: Colors.warning, letterSpacing: 1.5 },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xxl },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted, letterSpacing: 2 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  metricLabel: { fontSize: FontSize.sm, color: Colors.text },
  metricValue: { fontSize: FontSize.sm, color: Colors.textDim },
  progressBarContainer: {
    height: 6,
    backgroundColor: Colors.surfaceHover,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.xxl,
  },
  progressBar: { height: '100%', borderRadius: 3 },
  disruptorLabel: { fontSize: FontSize.sm, color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  disruptorCard: {
    backgroundColor: Colors.dangerMuted,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  disruptorName: { fontSize: FontSize.md, fontWeight: '500', color: Colors.danger, marginBottom: 4 },
  disruptorHint: { fontSize: FontSize.xs, color: 'rgba(239,68,68,0.6)' },
});
