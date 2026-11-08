
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export function configureGoogleSignIn() {
  if (!webClientId) {
    throw new Error('Google Web Client ID is not configured.');
  }

  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
  });
}

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices();

  const response = await GoogleSignin.signIn();

  if (response.type !== 'success') {
    return null;
  }

  const idToken = response.data?.idToken;

  if (!idToken) {
    throw new Error('Google did not return an ID token.');
  }

  return idToken;
}