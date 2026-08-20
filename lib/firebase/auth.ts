import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirebaseClientApp } from "./client";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export function getFirebaseClientAuth(): Auth {
  return getAuth(getFirebaseClientApp());
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(getFirebaseClientAuth(), googleProvider);
  return result.user;
}

export function signOutOfQRousel(): Promise<void> {
  return signOut(getFirebaseClientAuth());
}
