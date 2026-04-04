import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Colors, FontSize, BorderRadius, Spacing } from '@/lib/theme';

interface NudgeOverlayProps {
  visible: boolean;
  message: string;
  onResume: () => void;
  onEndSession: () => void;
}

export default function NudgeOverlay({ visible, message, onResume, onEndSession }: NudgeOverlayProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>🧠</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Back to Focus?</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnPrimary} onPress={onResume} activeOpacity={0.8}>
              <Text style={styles.btnPrimaryText}>I'm back to work</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={onEndSession} activeOpacity={0.8}>
              <Text style={styles.btnSecondaryText}>End Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.xxl,
    padding: Spacing.huge,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  iconText: {
    fontSize: 30,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '300',
    color: Colors.text,
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: Spacing.xxxl,
    fontWeight: '300',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: Colors.text,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#000',
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
});
