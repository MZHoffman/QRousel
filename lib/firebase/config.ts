import type { FirebaseOptions } from "firebase/app";

export const firebasePublicEnvironmentKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

export type FirebasePublicEnvironment = Partial<
  Record<(typeof firebasePublicEnvironmentKeys)[number], string>
>;

export function readFirebasePublicConfig(
  environment: FirebasePublicEnvironment,
): FirebaseOptions | null {
  const apiKey = environment.VITE_FIREBASE_API_KEY?.trim();
  const authDomain = environment.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = environment.VITE_FIREBASE_PROJECT_ID?.trim();
  const appId = environment.VITE_FIREBASE_APP_ID?.trim();

  const values = [apiKey, authDomain, projectId, appId];
  if (values.every((value) => !value)) return null;

  const missing = firebasePublicEnvironmentKeys.filter(
    (key) => !environment[key]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `Incomplete Firebase client configuration. Missing: ${missing.join(", ")}`,
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
  };
}
