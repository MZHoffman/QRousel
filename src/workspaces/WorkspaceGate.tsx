import type { User } from "firebase/auth";
import { FormEvent, useEffect, useState } from "react";
import type { WorkspaceSummary } from "../../lib/workspaces/api-response";
import {
  requestWorkspaceCreation,
  requestWorkspaces,
} from "./workspace-client";

type WorkspaceGateProps = {
  user: User;
  onSignOut: () => Promise<void>;
};

type WorkspaceState =
  | { kind: "loading" }
  | { kind: "create"; error: string }
  | { kind: "creating" }
  | { kind: "chooser"; workspaces: WorkspaceSummary[] }
  | { kind: "ready"; workspace: WorkspaceSummary }
  | { kind: "error"; message: string };

function workspacePath(workspace: WorkspaceSummary): string {
  return `/app/workspaces/${encodeURIComponent(workspace.id)}`;
}

function replacePath(path: string) {
  if (window.location.pathname !== path) {
    window.history.replaceState({}, "", path);
  }
}

function loadedWorkspaceState(workspaces: WorkspaceSummary[]): {
  path: string;
  state: WorkspaceState;
} {
  if (workspaces.length === 0) {
    return { path: "/app", state: { kind: "create", error: "" } };
  }
  if (workspaces.length === 1) {
    const workspace = workspaces[0];
    return {
      path: workspacePath(workspace),
      state: { kind: "ready", workspace },
    };
  }
  return { path: "/app", state: { kind: "chooser", workspaces } };
}

function workspaceLoadError(error: unknown): WorkspaceState {
  return {
    kind: "error",
    message:
      error instanceof Error
        ? error.message
        : "QRousel could not load your workspaces.",
  };
}

export default function WorkspaceGate({ user, onSignOut }: WorkspaceGateProps) {
  const [state, setState] = useState<WorkspaceState>({ kind: "loading" });
  const [name, setName] = useState("");

  async function loadWorkspaces() {
    try {
      const workspaces = await requestWorkspaces(user);
      const loaded = loadedWorkspaceState(workspaces);
      replacePath(loaded.path);
      setState(loaded.state);
    } catch (error) {
      setState(workspaceLoadError(error));
    }
  }

  function retryLoading() {
    setState({ kind: "loading" });
    void loadWorkspaces();
  }

  useEffect(() => {
    let current = true;
    void requestWorkspaces(user).then(
      (workspaces) => {
        if (!current) return;
        const loaded = loadedWorkspaceState(workspaces);
        replacePath(loaded.path);
        setState(loaded.state);
      },
      (error: unknown) => {
        if (current) setState(workspaceLoadError(error));
      },
    );

    return () => {
      current = false;
    };
  }, [user]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length === 0 || state.kind === "creating") return;

    setState({ kind: "creating" });
    try {
      const result = await requestWorkspaceCreation(user, name);
      if (result.kind === "limit") {
        setState({
          kind: "create",
          error: `You can create up to ${result.limit} workspaces.`,
        });
        return;
      }

      replacePath(workspacePath(result.workspace));
      setState({ kind: "ready", workspace: result.workspace });
    } catch (error) {
      setState({
        kind: "create",
        error:
          error instanceof Error
            ? error.message
            : "QRousel could not create this workspace.",
      });
    }
  }

  function openWorkspace(workspace: WorkspaceSummary) {
    replacePath(workspacePath(workspace));
    setState({ kind: "ready", workspace });
  }

  if (state.kind === "loading" || state.kind === "creating") {
    return (
      <main className="auth-shell" aria-label="Loading workspaces">
        <section className="auth-card">
          <a className="auth-brand" href="/">
            QRousel
          </a>
          <div className="auth-status">
            <span className="auth-spinner" aria-hidden="true" />
            <h1>
              {state.kind === "creating"
                ? "Creating your workspace"
                : "Loading your workspaces"}
            </h1>
            <p>This should only take a moment.</p>
          </div>
        </section>
      </main>
    );
  }

  if (state.kind === "create") {
    return (
      <main className="auth-shell">
        <section className="auth-card workspace-create-card">
          <a className="auth-brand" href="/">
            QRousel
          </a>
          <div className="auth-status">
            <p className="auth-eyebrow">Your first workspace</p>
            <h1>Create your workspace</h1>
            <p>
              Workspaces keep your decks, slides, QR codes, icons, and members
              together.
            </p>
            <form className="workspace-create-form" onSubmit={createWorkspace}>
              <label>
                <span>Workspace name</span>
                <input
                  autoComplete="organization"
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Hoffman Studio"
                />
              </label>
              {state.error && (
                <p className="auth-error" role="alert">
                  {state.error}
                </p>
              )}
              <button
                className="auth-primary-button"
                type="submit"
                disabled={name.trim().length === 0}
              >
                Create workspace
              </button>
            </form>
            <button
              className="workspace-sign-out"
              type="button"
              onClick={() => void onSignOut()}
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (state.kind === "chooser") {
    return (
      <main className="auth-shell">
        <section className="auth-card workspace-chooser-card">
          <a className="auth-brand" href="/">
            QRousel
          </a>
          <div className="auth-status">
            <p className="auth-eyebrow">Choose a workspace</p>
            <h1>Where are you working?</h1>
            <div className="workspace-choice-list">
              {state.workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => openWorkspace(workspace)}
                >
                  <strong>{workspace.name}</strong>
                  <span>{workspace.role}</span>
                </button>
              ))}
            </div>
            <button
              className="workspace-sign-out"
              type="button"
              onClick={() => void onSignOut()}
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <a className="auth-brand" href="/">
            QRousel
          </a>
          <div className="auth-status">
            <p className="auth-eyebrow">Unable to continue</p>
            <h1>We could not load your workspaces</h1>
            <p>{state.message}</p>
            <button
              className="auth-primary-button"
              type="button"
              onClick={retryLoading}
            >
              Try again
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <a className="auth-brand" href="/">
          QRousel
        </a>
        <div className="workspace-header-actions">
          <span>{user.email}</span>
          <button type="button" onClick={() => void onSignOut()}>
            Sign out
          </button>
        </div>
      </header>

      <section className="workspace-dashboard">
        <p className="auth-eyebrow">Workspace ready</p>
        <div className="workspace-title-row">
          <div>
            <h1>{state.workspace.name}</h1>
            <p>You are the Founder of this workspace.</p>
          </div>
          <span className="workspace-role">Founder</span>
        </div>

        <div className="workspace-empty-dashboard">
          <p className="auth-eyebrow">Next up</p>
          <h2>Create your first deck</h2>
          <p>
            Deck, slide, QR code, and icon libraries will be added in the next
            feature slices.
          </p>
        </div>
      </section>
    </main>
  );
}
