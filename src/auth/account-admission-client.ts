import type { User } from "firebase/auth";
import {
  isAccountAdmissionResponse,
  type AccountAdmissionResponse,
} from "../../lib/accounts/admission-response";

export async function requestAccountAdmission(
  user: User,
): Promise<AccountAdmissionResponse> {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/accounts/admit", {
    method: "POST",
    headers: {
      authorization: `Bearer ${idToken}`,
    },
  });
  const body: unknown = await response.json().catch(() => null);

  if (isAccountAdmissionResponse(body)) {
    return body;
  }

  throw new Error(
    response.ok
      ? "QRousel returned an invalid account response."
      : "QRousel could not verify this account.",
  );
}
