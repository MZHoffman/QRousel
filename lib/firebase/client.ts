"use client";

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
  NEXT_PUBLIC_FIREBASE_API_KEY:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
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
