import { signInWithEmailAndPassword } from "firebase/auth";
import { getFirebaseClientAuth } from "../lib/firebase/auth";

declare global {
  interface Window {
    __qrouselE2e?: {
      signIn(email: string, password: string): Promise<void>;
      getToken(): Promise<string>;
    };
  }
}

window.__qrouselE2e = {
  async signIn(email, password) {
    await signInWithEmailAndPassword(getFirebaseClientAuth(), email, password);
  },
  async getToken() {
    const token = await getFirebaseClientAuth().currentUser?.getIdToken();
    if (!token) throw new Error("The E2E user is not signed in.");
    return token;
  },
};
