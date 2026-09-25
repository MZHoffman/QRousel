import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { WorkspaceActivityEntry } from "../../lib/activity/api-response";
import { describeWorkspaceActivity } from "../../lib/activity/presentation";
import { requestWorkspaceActivity } from "./activity-client";

type ActivityState =
  | { kind: "loading" }
  | {
      kind: "ready";
      activity: WorkspaceActivityEntry[];
      nextCursor: string | null;
    }
  | { kind: "error"; message: string };

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  defaultDisplayDurationSeconds: "Default timing",
};

function ActivityGlyph({ resourceType }: { resourceType: WorkspaceActivityEntry["resourceType"] }) {
  if (resourceType === "deck") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="12" rx="2" /><path d="M9 20h6M12 17v3" /></svg>;
  if (resourceType === "slide") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="13" rx="2" /><path d="M7.5 9h9M7.5 13h5" /></svg>;
  if (resourceType === "qr-code") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="5" height="5" /><rect x="15" y="4" width="5" height="5" /><rect x="4" y="15" width="5" height="5" /><path d="M14 14h2v2h-2zm3 3h3v3h-3zm-3 2h2" /></svg>;
  if (resourceType === "icon") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 7-7 11L5 10l7-7Z" /><path d="m9.5 10.5 2.5 2.5 2.5-2.5" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>;
}

export default function ActivityPage({
  user,
  workspaceId,
}: {
  user: User;
  workspaceId: string;
}) {
  const [state, setState] = useState<ActivityState>({ kind: "loading" });
  const [reloadVersion, setReloadVersion] = useState(0);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState("");

  useEffect(() => {
    let current = true;
    void requestWorkspaceActivity(user, workspaceId).then(
      (page) => {
        if (current) {
          setState({ kind: "ready", ...page });
          setOlderError("");
        }
      },
      (error: unknown) => {
        if (!current) return;
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "QRousel could not load workspace activity.",
        });
      },
    );
    return () => {
      current = false;
    };
  }, [reloadVersion, user, workspaceId]);

  function retry() {
    setState({ kind: "loading" });
    setReloadVersion((version) => version + 1);
  }

  async function loadOlder() {
    if (
      state.kind !== "ready" ||
      state.nextCursor === null ||
      isLoadingOlder
    ) {
      return;
    }
    setIsLoadingOlder(true);
    setOlderError("");
    try {
      const page = await requestWorkspaceActivity(
        user,
        workspaceId,
        state.nextCursor,
      );
      setState((current) =>
        current.kind !== "ready"
          ? current
          : {
              kind: "ready",
              activity: [...current.activity, ...page.activity],
              nextCursor: page.nextCursor,
            },
      );
    } catch (error) {
      setOlderError(
        error instanceof Error
          ? error.message
          : "QRousel could not load older activity.",
      );
    } finally {
      setIsLoadingOlder(false);
    }
  }

  return (
    <>
      <header className="workspace-page-heading activity-page-heading">
        <div>
          <h1>Activity</h1>
          <p>Review who changed workspace resources and when.</p>
        </div>
      </header>

      {state.kind === "loading" && (
        <section className="activity-status" aria-label="Loading activity">
          <span className="auth-spinner" aria-hidden="true" />
          <p>Loading workspace activity…</p>
        </section>
      )}

      {state.kind === "error" && (
        <section className="activity-status">
          <h2>We could not load activity</h2>
          <p>{state.message}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </section>
      )}

      {state.kind === "ready" && state.activity.length === 0 && (
        <section className="activity-status">
          <span className="workspace-activity-dot" aria-hidden="true" />
          <h2>No activity yet</h2>
          <p>Important workspace changes will appear here.</p>
        </section>
      )}

      {state.kind === "ready" && state.activity.length > 0 && (
        <>
          <div className="activity-feed-summary">
            <span>
              {state.activity.length} {state.activity.length === 1 ? "event" : "events"}
            </span>
            <span>Loaded in pages of 25 changes</span>
          </div>
          <ol className="activity-feed" aria-label="Workspace activity">
            {state.activity.map((entry) => {
              const description = describeWorkspaceActivity(entry);
              const changedFields = entry.changedFields?.map(
                (field) => FIELD_LABELS[field] ?? field,
              );
              return (
                <li key={entry.id}>
                  <span className="activity-feed-mark" aria-hidden="true">
                    <ActivityGlyph resourceType={entry.resourceType} />
                  </span>
                  <div className="activity-feed-copy">
                    <strong>{description.title}</strong>
                    <p>{description.detail}</p>
                    {changedFields && changedFields.length > 0 && (
                      <span>Changed: {changedFields.join(", ")}</span>
                    )}
                  </div>
                  <time dateTime={entry.occurredAt}>
                    {TIME_FORMATTER.format(new Date(entry.occurredAt))}
                  </time>
                </li>
              );
            })}
          </ol>
          {state.nextCursor !== null && (
            <div className="activity-load-older">
              {olderError && (
                <p className="auth-error" role="alert">
                  {olderError}
                </p>
              )}
              <button
                type="button"
                disabled={isLoadingOlder}
                onClick={() => void loadOlder()}
              >
                {isLoadingOlder ? "Loading older activity…" : "Load older activity"}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
