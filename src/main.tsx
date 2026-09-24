import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import SignInPage from "./auth/LazySignInPage";
import LandingPage from "./marketing/LandingPage";
import PublicPresentationPage from "./presentation/PublicPresentationPage";
import "./styles.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("QRousel could not find its application root.");
}

createRoot(root).render(
  <StrictMode>
    {window.location.pathname.startsWith("/present/") ? <PublicPresentationPage deckId={decodeURIComponent(window.location.pathname.slice("/present/".length))} /> : window.location.pathname === "/sign-in" || window.location.pathname.startsWith("/app") ? (
      <Suspense
        fallback={
          <main className="auth-shell" aria-label="Loading sign in" />
        }
      >
        <SignInPage />
      </Suspense>
    ) : (
      <LandingPage />
    )}
  </StrictMode>,
);
