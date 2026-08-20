import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from "firebase/app";
import {
  firebasePublicEnvironmentKeys,
  readFirebasePublicConfig,
  type FirebasePublicEnvironment,
} from "./config";

const firebasePublicEnvironment = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
} satisfies FirebasePublicEnvironment;

export function isFirebaseClientConfigured(): boolean {
  return readFirebasePublicConfig(firebasePublicEnvironment) !== null;
}

export function getFirebaseClientApp(): FirebaseApp {
  const config = readFirebasePublicConfig(firebasePublicEnvironment);
  if (config === null) {
    throw new Error(
      `Firebase client is not configured. Set ${firebasePublicEnvironmentKeys.join(", ")}.`,
    );
  }

  return getApps().length > 0 ? getApp() : initializeApp(config);
}
