
import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signup } from '../api/auth';

export default function SignupScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const showError = (title, message) => {
    setErrorMessage(`${title}: ${message}`);
    // React Native Web's Alert.alert is a no-op; inline feedback works everywhere.
    if (Platform.OS !== 'web') Alert.alert(title, message);
  };

  const handleSignup = async () => {
    setErrorMessage('');
  if (
    !name.trim() ||
    !email.trim() ||
    !password ||
    !confirmPassword
  ) {
    showError('Error', 'Please fill in all fields.');
    return;
  }

  const ucrEmailRegex = /^[^\s@]+@ucr\.edu$/i;

  if (!ucrEmailRegex.test(email.trim())) {
    showError(
      'Invalid Email',
      'Please use a valid UCR email address.'
    );
    return;
  }

  if (password.length < 8) {
    showError(
      'Weak Password',
      'Password must be at least 8 characters long.'
    );
    return;
  }

  if (password !== confirmPassword) {
    showError(
      'Password Mismatch',
      'Passwords do not match.'
    );
    return;
  }

  setLoading(true);

  try {
    await signup(name.trim(), email, password);

    // Registration succeeded; login is a separate step.
    // Email ownership verification is not implemented yet.
    router.replace('/login');
  } catch (error) {
    showError(
      'Sign Up Failed',
      error.message || 'Unable to create your account.'
    );
  } finally {
    setLoading(false);
  }
};

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>StudyScotty</Text>
      <Text style={styles.subtitle}>Create Your Account</Text>
      {errorMessage ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}

      <TextInput
      style={styles.input}
      placeholder="Username"
      autoCapitalize="none"
      autoCorrect={false}
      value={name}
      onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="UCR Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password (8+ characters)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity
      style={styles.button}
      onPress={handleSignup}
      disabled={loading}
      >
  <Text style={styles.buttonText}>
    {loading ? 'Creating Account...' : 'Create Account'}
  </Text>
</TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace('/login')}
      >
        <Text style={styles.link}>
          Already have an account? Log In
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  error: { color: '#b42318', marginBottom: 16, fontSize: 15 },
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
  link: {
    color: '#2463a0',
    textAlign: 'center',
    marginTop: 25,
    fontSize: 15,
  },
});
