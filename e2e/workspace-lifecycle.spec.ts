import { expect, test } from "@playwright/test";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const email = "e2e.owner@example.test";
const password = "e2e-password-123";

async function createEmulatorAccount() {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=e2e", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!response.ok) throw new Error(`Could not create the E2E account: ${await response.text()}`);
}

test("creates reusable icons, QR codes, slides, and a deck, then permanently cleans up", async ({ page }) => {
  await createEmulatorAccount();
  await page.goto("/app");
  await page.waitForFunction(() => Boolean(window.__qrouselE2e));
  await page.evaluate(({ email, password }) => window.__qrouselE2e?.signIn(email, password), { email, password });

  await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();
  await page.getByLabel("Workspace name").fill("E2E workspace");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("heading", { name: "E2E workspace" })).toBeVisible();

  await page.getByRole("link", { name: "Members" }).click();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invite members" })).toBeVisible();
  const invitationResponse = page.waitForResponse((response) => response.url().includes("/api/workspaces/") && response.url().endsWith("/invitations") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create invite link" }).click();
  expect((await invitationResponse).status()).toBe(201);
  await expect(page.getByRole("textbox", { name: "One-use invite link" })).toHaveValue(/invite=/);
  await expect(page.getByText("A workspace is required.")).not.toBeVisible();
  await expect(page.getByText("Method not allowed.")).not.toBeVisible();

  await page.getByRole("link", { name: "Icons" }).click();
  for (const name of ["E2E icon alpha", "E2E icon beta"]) {
    await page.getByRole("button", { name: "Add icon" }).click();
    await page.getByLabel("Name").fill(name);
    await page.locator('input[type="file"]').setInputFiles({ name: `${name}.png`, mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Save icon" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }

  await page.getByRole("link", { name: "QR codes" }).click();
  for (const [name, icon] of [["E2E QR alpha", "E2E icon alpha"], ["E2E QR beta", "E2E icon beta"]] as const) {
    await page.getByRole("button", { name: /(?:Create your first QR code|Add QR code)/ }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Content").fill(`https://example.test/${name.toLowerCase().replaceAll(" ", "-")}`);
    await page.getByLabel(icon).click();
    await page.getByRole("button", { name: /Create QR code/ }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }

  await page.getByRole("link", { name: "Slides" }).click();
  for (const [title, qr] of [["E2E Slide alpha", "E2E QR alpha"], ["E2E Slide beta", "E2E QR beta"]] as const) {
    await page.getByRole("button", { name: /(?:Create your first slide|Add slide)/ }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill(`Description for ${title}`);
    await page.getByLabel("QR code").selectOption({ label: qr });
    await page.getByRole("button", { name: "Create slide" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }

  await page.getByRole("link", { name: "Decks" }).click();
  await page.getByRole("button", { name: /(?:Create your first deck|Add deck)/ }).click();
  await page.getByLabel("Deck name").fill("E2E deck");
  await page.getByRole("button", { name: "Create deck" }).click();
  await expect(page.getByRole("heading", { name: "E2E deck" })).toBeVisible();
  await page.getByRole("combobox").last().selectOption({ label: "E2E Slide alpha" });
  await page.getByRole("button", { name: "Add slide" }).last().click();
  await expect(page.getByRole("heading", { name: "E2E Slide alpha" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "E2E Slide alpha" })).toBeVisible();
  await expect(page.getByText("QRousel could not load slides for this deck.")).not.toBeVisible();

  const cleanup = await page.evaluate(async () => {
    const token = await window.__qrouselE2e?.getToken();
    const workspaceId = window.location.pathname.split("/")[3];
    if (!token || !workspaceId) throw new Error("Missing E2E session or workspace.");
    const headers = { authorization: `Bearer ${token}` };
    const request = async (path: string) => {
      const response = await fetch(path, { headers });
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return response.json();
    };
    const [decks, slides, qrCodes, icons] = await Promise.all([
      request(`/api/workspaces/${workspaceId}/decks`), request(`/api/workspaces/${workspaceId}/slides`), request(`/api/workspaces/${workspaceId}/qr-codes`), request(`/api/workspaces/${workspaceId}/icons`),
    ]);
    const resources = [["decks", decks.decks], ["slides", slides.slides], ["qr-codes", qrCodes.qrCodes], ["icons", icons.icons]] as const;
    for (const [type, items] of resources) for (const item of items.filter((candidate: { name?: string; title?: string }) => (candidate.name ?? candidate.title ?? "").startsWith("E2E "))) {
      const archive = await fetch(`/api/workspaces/${workspaceId}/trash/${type}/${item.id}`, { method: "PATCH", headers });
      if (!archive.ok) throw new Error(`Could not trash ${type}/${item.id}`);
      const remove = await fetch(`/api/workspaces/${workspaceId}/trash/${type}/${item.id}`, { method: "DELETE", headers });
      if (!remove.ok) throw new Error(`Could not delete ${type}/${item.id}`);
    }
    return workspaceId;
  });
  await page.goto(`/app/workspaces/${cleanup}/trash`);
  await expect(page.getByRole("heading", { name: "Trash" })).toBeVisible();
  await expect(page.getByText("Trash is empty")).toBeVisible();
});
