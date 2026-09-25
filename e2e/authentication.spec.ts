import { expect, test } from "@playwright/test";

const email = "e2e.authentication@example.test";
const password = "e2e-password-123";

async function createEmulatorAccount() {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=e2e", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!response.ok) throw new Error(`Could not create the E2E account: ${await response.text()}`);
}

test("protects the workspace app and presents both sign-in routes", async ({ page }) => {
  await page.goto("/app");

  await expect(page.getByRole("heading", { name: "Sign in to QRousel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeDisabled();

  await page.getByPlaceholder("you@example.com").fill("person@example.test");
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeEnabled();
});

test("admits an emulator-authenticated account and opens the workspace gate", async ({ page }) => {
  await createEmulatorAccount();
  await page.goto("/app");
  await page.waitForFunction(() => Boolean(window.__qrouselE2e));
  await page.evaluate(({ testEmail, testPassword }) => window.__qrouselE2e?.signIn(testEmail, testPassword), { testEmail: email, testPassword: password });

  await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();
});
