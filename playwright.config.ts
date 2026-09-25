import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:8888", screenshot: "only-on-failure" },
  webServer: {
  command: "npx netlify-cli dev --offline --port 8888 --command 'npx vite --host 127.0.0.1 --port 5173'",
    url: "http://127.0.0.1:8888",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      GCLOUD_PROJECT: "qrousel-e2e",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      QROUSEL_E2E: "true",
      VITE_QROUSEL_E2E: "true",
      VITE_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      VITE_FIREBASE_API_KEY: "e2e-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "127.0.0.1",
      VITE_FIREBASE_PROJECT_ID: "qrousel-e2e",
      VITE_FIREBASE_APP_ID: "1:123456789:web:e2e",
    },
  },
});
