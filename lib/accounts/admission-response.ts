export type AccountAdmissionResponse =
  | { status: "active"; newAccount: boolean }
  | { status: "suspended"; newAccount: false }
  | { status: "capacity_reached"; limit: number };

export function isAccountAdmissionResponse(
  value: unknown,
): value is AccountAdmissionResponse {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return false;
  }

  if (value.status === "active") {
    return "newAccount" in value && typeof value.newAccount === "boolean";
  }

  if (value.status === "suspended") {
    return "newAccount" in value && value.newAccount === false;
  }

  return (
    value.status === "capacity_reached" &&
    "limit" in value &&
    value.limit === 200
  );
}
