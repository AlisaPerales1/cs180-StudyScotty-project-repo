import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import { login, loginWithGoogle } from '../api/auth';
import {
  configureGoogleSignIn,
  signInWithGoogle,
} from '../api/googleAuth';
import { saveTokens } from '../api/tokenStorage';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Regular email/password login
  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (!email.trim().toLowerCase().endsWith('@ucr.edu')) {
      Alert.alert('Invalid Email', 'Please use your UCR email.');
      return;
    }

    setLoading(true);

    try {
      const response = await login(email, password);

      if (!response.access || !response.refresh) {
        throw new Error(
          'The server did not return authentication tokens.'
        );
      }

      console.log(
        'Login successful for:',
        response.user?.username
      );

      await saveTokens(response.access, response.refresh);
      router.replace('/discovery');
    } catch (error) {
      console.error('Login error:', error);

      Alert.alert(
        'Login Failed',
        error.message || 'Unable to connect to the server.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In with Django backend
  const handleGoogleLogin = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Not Available',
        'Google Sign-In for web is coming soon.'
      );
      return;
    }

    setLoading(true);

    try {
      // Step 1: Configure Google Sign-In
      configureGoogleSignIn();

      // Step 2: Sign in with Google
      const idToken = await signInWithGoogle();

      if (!idToken) {
        return;
      }

      // Step 3: Send Google ID token to Django
      const response = await loginWithGoogle(idToken);

      // Step 4: Verify StudyScotty JWT tokens
      if (!response.access || !response.refresh) {
        throw new Error(
          'The server did not return authentication tokens.'
        );
      }

      console.log(
        'Google login successful for:',
        response.user?.email
      );

      // Step 5: Navigate to Discover
      await saveTokens(response.access, response.refresh);
      router.replace('/discovery');

    } catch (error) {
      console.error('Google Sign-In error:', error);

      Alert.alert(
        'Google Sign-In Failed',
        error.message || 'Unable to sign in with Google.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>StudyScotty</Text>
      <Text style={styles.subtitle}>Welcome Back!</Text>

      <TextInput
        style={styles.input}
        placeholder="UCR Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Logging In...' : 'Log In'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleLogin}
        disabled={loading}
      >
        <Text style={styles.googleButtonText}>
          {loading ? 'Please wait...' : 'Continue with Google'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/signup')}
        disabled={loading}
      >
        <Text style={styles.link}>
          Don't have an account? Sign Up
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 25,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2463a0',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 35,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2463a0',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    marginTop: 15,
  },
  googleButtonText: {
    color: '#2463a0',
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: {
    color: '#2463a0',
    textAlign: 'center',
    marginTop: 25,
    fontSize: 15,
  },
});