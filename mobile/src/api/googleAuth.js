
// Deferred until the Google native plugin and OAuth client setup are reviewed.
// Keep the implementation, but never load its native module in Expo Go.
export const GOOGLE_SIGN_IN_ENABLED = false;

async function getGoogleSignin() {
  if (!GOOGLE_SIGN_IN_ENABLED) {
    throw new Error('Google Sign-In is not available yet. Please use email and password.');
  }
  return (await import('@react-native-google-signin/google-signin')).GoogleSignin;
}

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export async function configureGoogleSignIn() {
  if (!webClientId) {
    throw new Error('Google Web Client ID is not configured.');
  }

  const GoogleSignin = await getGoogleSignin();
  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
  });
}

export async function signInWithGoogle() {
  const GoogleSignin = await getGoogleSignin();
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
