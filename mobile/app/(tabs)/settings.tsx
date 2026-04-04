import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/components/AuthProvider';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { User } from '@/types/firestore';
import { Colors, FontSize, BorderRadius, Spacing } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [notificationPref, setNotificationPref] = useState('Important');
  const [sensitivityLevel, setSensitivityLevel] = useState('Medium');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      if (!user) return;
      try {
        const userDocRef = doc(db, 'User', user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const userData = docSnap.data() as User;
          if (userData.Settings) {
            setNotificationPref(userData.Settings.Notification_Preference || 'Important');
            setSensitivityLevel(userData.Settings.Sensitivity_Level || 'Medium');
          }
          if (userData.Name && !displayName) {
             setDisplayName(userData.Name);
          }
        }
      } catch (error) {
        console.error('Failed to load settings', error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // 1. Update Firebase Auth Profile
      if (displayName !== user.displayName) {
        await updateProfile(user, { displayName: displayName });
      }

      // 2. Update Firestore document
      const userDocRef = doc(db, 'User', user.uid);
      await updateDoc(userDocRef, {
        Name: displayName,
        Settings: {
          Notification_Preference: notificationPref,
          Sensitivity_Level: sensitivityLevel,
        },
      });
      
      Alert.alert('Success', 'Profile and settings updated successfully.');
    } catch (error) {
      console.error('Error saving settings', error);
      Alert.alert('Error', 'Failed to save updates.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Settings</Text>
          <Text style={styles.pageSubtitle}>Configure your focus parameters.</Text>
        </View>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons name="save-outline" size={16} color="#000" />
          )}
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      {/* Account */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Display Name</Text>
          <TextInput
            style={styles.textInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={Colors.textDim}
          />
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Email Address</Text>
          <TextInput
            style={[styles.textInput, styles.disabledInput]}
            value={user?.email || 'user@example.com'}
            editable={false}
          />
        </View>
      </View>

      {/* AI Sensitivity */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.sectionTitle}>FOCUS CONFIGURATION</Text>
        </View>
        <Text style={styles.fieldLabel}>AI Interference Sensitivity</Text>
        <Text style={styles.fieldHint}>
          How aggressively should the AI detect distractions during a Focus Session?
        </Text>
        <View style={styles.buttonGrid}>
          {['Low', 'Medium', 'High', 'Strict'].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.optionButton,
                sensitivityLevel === level && styles.optionButtonActive,
              ]}
              onPress={() => setSensitivityLevel(level)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  sensitivityLevel === level && styles.optionButtonTextActive,
                ]}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="notifications-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
        </View>
        {[
          { value: 'All', title: 'All Activities', desc: 'Get notified for every focus gap and achievement.' },
          { value: 'Important', title: 'Important Only', desc: 'Only alert me when I am severely drifting.' },
          { value: 'None', title: 'Do Not Disturb', desc: 'No notifications. Pure silence.' },
        ].map((pref) => (
          <TouchableOpacity
            key={pref.value}
            style={styles.radioRow}
            onPress={() => setNotificationPref(pref.value)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.radioCircle,
                notificationPref === pref.value && styles.radioCircleActive,
              ]}
            >
              {notificationPref === pref.value && <View style={styles.radioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.radioTitle}>{pref.title}</Text>
              <Text style={styles.radioDesc}>{pref.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, paddingTop: 60 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xxl,
  },
  pageTitle: { fontSize: 28, fontWeight: '300', color: Colors.text, letterSpacing: -0.5, marginBottom: 4 },
  pageSubtitle: { fontSize: FontSize.md, color: Colors.textMuted, fontWeight: '300' },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: Colors.text,
    borderRadius: BorderRadius.md,
  },
  saveButtonText: { color: '#000', fontWeight: '600', fontSize: FontSize.sm },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#0e0e0e',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    padding: Spacing.lg,
  },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 2 },
  fieldRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: 6, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textDim, marginBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
  textInput: {
    backgroundColor: Colors.surfaceHover,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  disabledInput: { backgroundColor: 'rgba(20,20,20,0.5)', color: Colors.textDim },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  optionButton: {
    flex: 1,
    minWidth: '40%',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  optionButtonActive: { borderColor: Colors.text, backgroundColor: 'rgba(255,255,255,0.05)' },
  optionButtonText: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textDim },
  optionButtonTextActive: { color: Colors.text },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.textDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  radioCircleActive: { borderColor: Colors.accent, backgroundColor: 'rgba(16,185,129,0.2)' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  radioTitle: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.text },
  radioDesc: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
  },
  logoutText: { fontSize: FontSize.md, color: Colors.danger, fontWeight: '500' },
});
