import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirebaseClientApp } from "./client";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
let emulatorConnected = false;

export function getFirebaseClientAuth(): Auth {
  const auth = getAuth(getFirebaseClientApp());
  if (import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST && !emulatorConnected) {
    connectAuthEmulator(auth, `http://${import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    emulatorConnected = true;
  }
  return auth;
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(getFirebaseClientAuth(), googleProvider);
  return result.user;
}

export function signOutOfQRousel(): Promise<void> {
  return signOut(getFirebaseClientAuth());
}

export async function sendEmailSignInLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(getFirebaseClientAuth(), email, {
    url: `${window.location.origin}/sign-in`,
    handleCodeInApp: true,
  });
  window.localStorage.setItem("qrousel-email-link", email);
}

export async function completeEmailSignInLink(): Promise<User | null> {
  const auth = getFirebaseClientAuth();
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;
  const email = window.localStorage.getItem("qrousel-email-link") ?? window.prompt("Enter the email address used to request this sign-in link.");
  if (!email) throw new Error("An email address is required to complete sign-in.");
  const result = await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem("qrousel-email-link");
  window.history.replaceState({}, "", "/app");
  return result.user;
}
