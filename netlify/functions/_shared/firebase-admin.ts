import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";

type ServiceAccountJson = {
  project_id?: unknown;
  client_email?: unknown;
  private_key?: unknown;
};

function readServiceAccount(): ServiceAccount {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
  }

  let value: ServiceAccountJson;
  try {
    value = JSON.parse(rawServiceAccount) as ServiceAccountJson;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }

  if (
    typeof value.project_id !== "string" ||
    typeof value.client_email !== "string" ||
    typeof value.private_key !== "string"
  ) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing required credentials.",
    );
  }

  return {
    projectId: value.project_id,
    clientEmail: value.client_email,
    privateKey: value.private_key.replace(/\\n/g, "\n"),
  };
}

export function getFirebaseAdminApp(): App {
  const isEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST,
  );
  return (
    getApps()[0] ??
    (isEmulator
      ? initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "qrousel-e2e" })
      : initializeApp({ credential: cert(readServiceAccount()) }))
  );
}
