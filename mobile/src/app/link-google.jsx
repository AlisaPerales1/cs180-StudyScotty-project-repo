import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import { getAccessToken } from '../api/tokenStorage';
import {
  configureGoogleSignIn,
  signInWithGoogle,
} from '../api/googleAuth';

import { linkGoogleAccount } from '../api/auth';

export default function LinkGoogleScreen() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLinkGoogle = async () => {
    const accessToken = await getAccessToken();

if (!accessToken) {
  throw new Error(
    'Please log in to StudyScotty before linking Google.'
  );
    }
    if (!password) {
      Alert.alert(
        'Missing Information',
        'Please provide your password and access token.'
      );
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert(
        'Not Available',
        'Google account linking is currently available on mobile.'
      );
      return;
    }

    setLoading(true);

    try {
      configureGoogleSignIn();

      const idToken = await signInWithGoogle();

      if (!idToken) return;

      const response = await linkGoogleAccount(
        idToken,
        password,
        accessToken
      );

      Alert.alert(
        'Success',
        response.message || 'Google account linked successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/discover'),
          },
        ]
      );
    } catch (error) {
      console.error('Google linking error:', error);

      Alert.alert(
        'Linking Failed',
        error.message || 'Unable to link Google account.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Link Google Account</Text>

      <Text style={styles.description}>
        Connect your Google account to your existing
        StudyScotty account.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="StudyScotty Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLinkGoogle}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Linking...' : 'Link Google Account'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>Cancel</Text>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2463a0',
    textAlign: 'center',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
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
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  back: {
    color: '#2463a0',
    textAlign: 'center',
    marginTop: 20,
  },
});