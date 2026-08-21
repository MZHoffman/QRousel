import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./firebase-admin.ts";

function isGoogleIdentity(token: DecodedIdToken): boolean {
  return (
    token.firebase.sign_in_provider === "google.com" &&
    token.email_verified === true &&
    typeof token.email === "string"
  );
}

export async function authenticateActiveAccount(
  idToken: string,
): Promise<{ uid: string } | null> {
  const token = await getAuth(getFirebaseAdminApp()).verifyIdToken(
    idToken,
    true,
  );
  if (!isGoogleIdentity(token)) return null;

  const accountSnapshot = await getFirestore(getFirebaseAdminApp())
    .doc(`accounts/${token.uid}`)
    .get();
  if (!accountSnapshot.exists || accountSnapshot.get("status") !== "active") {
    return null;
  }

  return { uid: token.uid };
}
