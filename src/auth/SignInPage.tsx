import { onIdTokenChanged, type Auth, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import {
  getFirebaseClientAuth,
  signInWithGoogle,
  signOutOfQRousel,
} from "../../lib/firebase/auth";
import { isFirebaseClientConfigured } from "../../lib/firebase/client";
import WorkspaceGate from "../workspaces/WorkspaceGate";
import { requestAccountAdmission } from "./account-admission-client";

type SessionState =
  | "checking"
  | "signed_out"
  | "admitting"
  | "active"
  | "suspended"
  | "capacity"
  | "unconfigured"
  | "error";

type FirebaseSetup = {
  auth: Auth | null;
  error: string;
  state: Extract<SessionState, "checking" | "unconfigured" | "error">;
};

function prepareFirebase(): FirebaseSetup {
  try {
    if (!isFirebaseClientConfigured()) {
      return { auth: null, error: "", state: "unconfigured" };
    }

    return { auth: getFirebaseClientAuth(), error: "", state: "checking" };
  } catch (error) {
    return {
      auth: null,
      error:
        error instanceof Error
          ? error.message
          : "Firebase is not configured correctly.",
      state: "error",
    };
  }
}

export default function SignInPage() {
  const [firebaseSetup] = useState(prepareFirebase);
  const [sessionState, setSessionState] = useState<SessionState>(
    firebaseSetup.state,
  );
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState(firebaseSetup.error);
  const creatingAccount = new URLSearchParams(window.location.search).get("intent") === "create-account";

  const admit = useCallback(
    async (userToAdmit: User, isCurrent: () => boolean) => {
      setSessionState("admitting");
      setMessage("");
      try {
        const result = await requestAccountAdmission(userToAdmit);
        if (!isCurrent()) return;

        if (result.status === "capacity_reached") {
          setSessionState("capacity");
        } else {
          setSessionState(result.status);
        }
      } catch (error) {
        if (!isCurrent()) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "QRousel could not verify this account.",
        );
        setSessionState("error");
      }
    },
    [],
  );

  useEffect(() => {
    let current = true;
    const isCurrent = () => current;

    if (firebaseSetup.auth === null) {
      return () => {
        current = false;
      };
    }

    const unsubscribe = onIdTokenChanged(firebaseSetup.auth, (nextUser) => {
      if (!current) return;
      setUser(nextUser);
      if (nextUser === null) {
        setSessionState("signed_out");
        setMessage("");
        return;
      }
      void admit(nextUser, isCurrent);
    });

    return () => {
      current = false;
      unsubscribe();
    };
  }, [admit, firebaseSetup]);

  async function beginSignIn() {
    setMessage("");
    try {
      await signInWithGoogle();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Google sign-in failed.",
      );
    }
  }

  async function retryAdmission() {
    if (user === null) return;
    await admit(user, () => true);
  }

  if (sessionState === "active" && user !== null) {
    return <WorkspaceGate user={user} onSignOut={signOutOfQRousel} />;
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-live="polite">
        <a className="auth-brand" href="/">
          QRousel
        </a>

        {sessionState === "checking" || sessionState === "admitting" ? (
          <div className="auth-status">
            <span className="auth-spinner" aria-hidden="true" />
            <h1>
              {sessionState === "checking"
                ? "Checking your account"
                : "Preparing your account"}
            </h1>
            <p>This should only take a moment.</p>
          </div>
        ) : sessionState === "suspended" ? (
          <div className="auth-status">
            <p className="auth-eyebrow">Account suspended</p>
            <h1>Access is currently unavailable</h1>
            <p>Contact the QRousel operator if you believe this is a mistake.</p>
            <button
              className="auth-secondary-button"
              type="button"
              onClick={() => void signOutOfQRousel()}
            >
              Sign out
            </button>
          </div>
        ) : sessionState === "capacity" ? (
          <div className="auth-status">
            <p className="auth-eyebrow">Free beta</p>
            <h1>Beta capacity reached</h1>
            <p>
              All 200 account places are currently in use. Existing QRousel
              accounts can still sign in.
            </p>
            <button
              className="auth-secondary-button"
              type="button"
              onClick={() => void signOutOfQRousel()}
            >
              Use another account
            </button>
          </div>
        ) : sessionState === "unconfigured" ? (
          <div className="auth-status">
            <p className="auth-eyebrow">Local setup</p>
            <h1>Firebase is not configured</h1>
            <p>
              Add the public Firebase values to <code>.env.local</code> to test
              Google sign-in.
            </p>
            <a className="auth-secondary-link" href="/">
              Return to presentation
            </a>
          </div>
        ) : sessionState === "error" ? (
          <div className="auth-status">
            <p className="auth-eyebrow">Unable to continue</p>
            <h1>We could not verify your account</h1>
            <p>{message}</p>
            {user && (
              <button
                className="auth-primary-button"
                type="button"
                onClick={() => void retryAdmission()}
              >
                Try again
              </button>
            )}
          </div>
        ) : (
          <div className="auth-status">
            <p className="auth-eyebrow">Workspace access</p>
            <h1>{creatingAccount ? "Create your QRousel account" : "Sign in to QRousel"}</h1>
            <p>{creatingAccount ? "Use Google to create your free QRousel account and first workspace." : "Use your Google account to access your workspaces."}</p>
            {message && (
              <p className="auth-error" role="alert">
                {message}
              </p>
            )}
            <button
              className="auth-primary-button"
              type="button"
              onClick={() => void beginSignIn()}
            >
              <span aria-hidden="true">G</span>
              {creatingAccount ? "Create account with Google" : "Continue with Google"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
