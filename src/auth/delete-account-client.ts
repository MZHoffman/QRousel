import type { User } from "firebase/auth";

export async function deleteAccount(user: User): Promise<void> {
  const response = await fetch("/api/accounts", {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${await user.getIdToken()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
  });
  if (response.ok) return;

  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    throw new Error(body.error);
  }
  throw new Error("QRousel could not delete this account.");
}
