export const ACTIVE_ACCOUNT_LIMIT = 200;
export const ACCOUNT_NOTIFICATION_THRESHOLDS = [150, 180, 195, 200] as const;

export type AccountStatus = "active" | "suspended" | "deleted";

export type AccountAdmissionDecision =
  | {
      kind: "existing";
      status: Exclude<AccountStatus, "deleted">;
    }
  | {
      kind: "admit";
      nextActiveCount: number;
      notificationThreshold: number | null;
    }
  | {
      kind: "capacity";
      limit: number;
    };

type AccountAdmissionInput = {
  activeCount: number;
  existingStatus?: AccountStatus;
};

export function decideAccountAdmission({
  activeCount,
  existingStatus,
}: AccountAdmissionInput): AccountAdmissionDecision {
  if (!Number.isSafeInteger(activeCount) || activeCount < 0) {
    throw new Error("The active account counter is invalid.");
  }

  if (existingStatus === "active" || existingStatus === "suspended") {
    return { kind: "existing", status: existingStatus };
  }

  if (activeCount >= ACTIVE_ACCOUNT_LIMIT) {
    return { kind: "capacity", limit: ACTIVE_ACCOUNT_LIMIT };
  }

  const nextActiveCount = activeCount + 1;
  const notificationThreshold = ACCOUNT_NOTIFICATION_THRESHOLDS.includes(
    nextActiveCount as (typeof ACCOUNT_NOTIFICATION_THRESHOLDS)[number],
  )
    ? nextActiveCount
    : null;

  return {
    kind: "admit",
    nextActiveCount,
    notificationThreshold,
  };
}
