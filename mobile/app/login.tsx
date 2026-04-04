import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
} from 'firebase/auth';
import { DatabaseService } from '@/lib/firebaseService';
import { Colors, FontSize, BorderRadius, Spacing } from '@/lib/theme';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // Log In
        await signInWithEmailAndPassword(auth, email, password);
        router.replace('/');
      } else {
        // Sign Up
        const result = await createUserWithEmailAndPassword(auth, email, password);
        
        // 1. Update Firebase Auth Profile with Name
        await updateProfile(result.user, { displayName: name });
        
        // 2. Initialize user profile in Firestore
        await DatabaseService.initializeUserProfile(result.user.uid, {
          Email: result.user.email || email,
          Name: name,
        });
        
        router.replace('/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  /** 
   * DEV MODE BYPASS: Allows testing the app UI and logic instantly
   */
  const handleGuestLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const guestUid = "dev_guest_id_001";
      await DatabaseService.initializeUserProfile(guestUid, {
        Email: 'guest@focus.dev',
        Name: 'Guest Tester',
      });
      router.replace('/');
    } catch (err: any) {
      setError("Dev Bypass failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Background gradient circles */}
      <View style={[styles.gradientCircle, styles.gradientPurple]} />
      <View style={[styles.gradientCircle, styles.gradientBlue]} />

      {/* Glassmorphism Card */}
      <View style={styles.card}>
        <Text style={styles.title}>{isLogin ? 'Welcome' : 'Join Us'}</Text>
        <Text style={styles.subtitle}>
          {isLogin ? 'Sign in to access your sessions.' : 'Start your focus journey today.'}
        </Text>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Name Field (Visible only on Sign Up) */}
        {!isLogin && (
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor={Colors.textDim}
            value={name}
            onChangeText={setName}
            editable={!loading}
          />
        )}

        {/* Email & Password Form */}
        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor={Colors.textDim}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.textDim}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />

        {/* Main Auth Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleAuth}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isLogin ? 'Sign In' : 'Create Account'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Toggle Login/Signup */}
        <TouchableOpacity 
          onPress={() => setIsLogin(!isLogin)}
          disabled={loading}
          style={styles.toggleButton}
        >
          <Text style={styles.toggleText}>
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* DEVELOPER BYPASS BUTTON */}
        <TouchableOpacity
          style={styles.guestButton}
          onPress={handleGuestLogin}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.guestButtonText}>Dev Mode: Continue as Guest</Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  gradientCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.15,
  },
  gradientPurple: {
    top: -60,
    left: -60,
    backgroundColor: '#9333ea',
  },
  gradientBlue: {
    bottom: -60,
    right: -60,
    backgroundColor: '#2563eb',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: Spacing.xxxl,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.xxl,
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '300',
    color: Colors.text,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '300',
    marginBottom: Spacing.xxxl,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: Colors.dangerMuted,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  errorText: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: Colors.text,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  primaryButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: '#000',
    letterSpacing: 0.5,
  },
  toggleButton: {
    marginBottom: Spacing.lg,
  },
  toggleText: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: Colors.textDim,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.xs,
  },
  guestButton: {
    marginTop: Spacing.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    width: '100%',
    alignItems: 'center',
  },
  guestButtonText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
