import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  ACTIVE_ACCOUNT_LIMIT,
  decideAccountAdmission,
  type AccountStatus,
} from "../../lib/accounts/admission";
import type { AccountAdmissionResponse } from "../../lib/accounts/admission-response";
import { getFirebaseAdminApp } from "./_shared/firebase-admin";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function isGoogleIdentity(token: DecodedIdToken): boolean {
  return (
    token.firebase.sign_in_provider === "google.com" &&
    token.email_verified === true &&
    typeof token.email === "string"
  );
}

function readAccountStatus(value: unknown): AccountStatus | undefined {
  if (value === undefined) return undefined;
  if (value === "active" || value === "suspended" || value === "deleted") {
    return value;
  }

  throw new Error("The stored account status is invalid.");
}

async function admitAccount(
  token: DecodedIdToken,
): Promise<AccountAdmissionResponse> {
  const app = getFirebaseAdminApp();
  const firestore = getFirestore(app);
  const accountRef = firestore.doc(`accounts/${token.uid}`);
  const counterRef = firestore.doc("system/accountAdmission");

  return firestore.runTransaction(async (transaction) => {
    const [accountSnapshot, counterSnapshot] = await Promise.all([
      transaction.get(accountRef),
      transaction.get(counterRef),
    ]);
    const existingStatus = readAccountStatus(
      accountSnapshot.exists ? accountSnapshot.get("status") : undefined,
    );
    const storedCount = counterSnapshot.exists
      ? counterSnapshot.get("activeCount")
      : 0;
    const decision = decideAccountAdmission({
      activeCount: storedCount,
      existingStatus,
    });
    const now = FieldValue.serverTimestamp();

    if (decision.kind === "capacity") {
      return { status: "capacity_reached", limit: decision.limit };
    }

    if (decision.kind === "existing") {
      transaction.update(accountRef, {
        displayName: token.name ?? null,
        email: token.email,
        lastSignInAt: now,
        photoUrl: token.picture ?? null,
        updatedAt: now,
      });
      return {
        status: decision.status,
        newAccount: false,
      };
    }

    transaction.set(accountRef, {
      createdAt: now,
      displayName: token.name ?? null,
      email: token.email,
      lastSignInAt: now,
      photoUrl: token.picture ?? null,
      status: "active",
      uid: token.uid,
      updatedAt: now,
    });

    const counterUpdate: Record<string, unknown> = {
      activeCount: decision.nextActiveCount,
      limit: ACTIVE_ACCOUNT_LIMIT,
      updatedAt: now,
    };
    if (decision.notificationThreshold !== null) {
      counterUpdate.thresholdsReached = FieldValue.arrayUnion(
        decision.notificationThreshold,
      );
      transaction.set(
        firestore.doc(
          `operatorNotifications/account-capacity-${decision.notificationThreshold}`,
        ),
        {
          activeCount: decision.notificationThreshold,
          createdAt: now,
          status: "pending",
          type: "account_capacity_threshold",
        },
        { merge: true },
      );
    }
    transaction.set(counterRef, counterUpdate, { merge: true });

    return { status: "active", newAccount: true };
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const bearerToken = readBearerToken(request);
  if (bearerToken === null) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }

  try {
    const token = await getAuth(getFirebaseAdminApp()).verifyIdToken(
      bearerToken,
      true,
    );
    if (!isGoogleIdentity(token)) {
      return jsonResponse({ error: "Google sign-in is required." }, 403);
    }

    const result = await admitAccount(token);
    return jsonResponse(result, result.status === "capacity_reached" ? 409 : 200);
  } catch (error) {
    console.error("Account admission failed.", error);
    return jsonResponse({ error: "Account admission is unavailable." }, 503);
  }
}
