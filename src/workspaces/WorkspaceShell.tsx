import { useEffect, useState, type MouseEvent } from "react";
import type { User } from "firebase/auth";
import type {
  WorkspaceRole,
  WorkspaceSummary,
} from "../../lib/workspaces/api-response";
import ActivityPage from "../activity/ActivityPage";
import DeckLibraryPage from "../decks/DeckLibraryPage";
import DeckEditorPage from "../decks/DeckEditorPage";
import DeckCreatePage from "../decks/DeckCreatePage";
import { useDeckLibrary } from "../decks/use-deck-library";
import SlideLibraryPage from "../slides/SlideLibraryPage";
import SlideCreatePage from "../slides/SlideCreatePage";
import { useSlideLibrary } from "../slides/use-slide-library";
import QrCodeLibraryPage from "../qr-codes/QrCodeLibraryPage";
import { useQrCodeLibrary } from "../qr-codes/use-qr-code-library";
import IconLibraryPage from "../icons/IconLibraryPage";
import { useIconLibrary } from "../icons/use-icon-library";
import {
  resolveWorkspaceDeckId,
  workspaceDeckPath,
} from "../../lib/decks/navigation";
import {
  WORKSPACE_NAVIGATION,
  resolveWorkspaceSection,
  workspaceSectionPath,
  type WorkspaceSection,
} from "../../lib/workspaces/navigation";
import {
  resolveWorkspaceResourceEditor,
  workspaceResourceEditorPath,
} from "../../lib/workspaces/resource-editor-navigation";

type WorkspaceShellProps = {
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  user: User;
  onWorkspaceChange: (workspace: WorkspaceSummary) => void;
  onSignOut: () => Promise<void>;
};

const RESOURCE_COPY: Record<
  Exclude<
    WorkspaceSection,
    "overview" | "decks" | "members" | "activity" | "trash"
  >,
  { eyebrow: string; title: string; description: string; empty: string }
> = {
  slides: {
    eyebrow: "Reusable content",
    title: "Slides",
    description: "Create slides once and use them across every deck.",
    empty: "No slides yet",
  },
  "qr-codes": {
    eyebrow: "Scannable resources",
    title: "QR codes",
    description: "Generate and manage QR codes for this workspace.",
    empty: "No QR codes yet",
  },
  icons: {
    eyebrow: "Visual library",
    title: "Icons",
    description: "Upload and prepare reusable icons for your QR codes.",
    empty: "No custom icons yet",
  },
};

function roleLabel(role: WorkspaceRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function NavigationGlyph({ section }: { section: WorkspaceSection }) {
  const paths: Record<WorkspaceSection, React.ReactNode> = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    decks: (
      <>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M8 21h8" />
      </>
    ),
    slides: (
      <>
        <rect x="5" y="3" width="16" height="14" rx="2" />
        <path d="M3 7v12a2 2 0 0 0 2 2h14" />
      </>
    ),
    "qr-codes": (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14h1" />
      </>
    ),
    icons: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
    members: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    activity: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[section]}
    </svg>
  );
}

function ResourcePage({
  section,
}: {
  section: keyof typeof RESOURCE_COPY;
}) {
  const copy = RESOURCE_COPY[section];
  return (
    <>
      <header className="workspace-page-heading">
        <div>
          <p className="workspace-kicker">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </header>
      <section className="workspace-library-empty">
        <span className="workspace-empty-mark" aria-hidden="true">
          <NavigationGlyph section={section} />
        </span>
        <h2>{copy.empty}</h2>
        <p>Your workspace library is ready for its first item.</p>
      </section>
    </>
  );
}

function WorkspacePage({
  section,
  workspace,
  userEmail,
  navigate,
  deckLibrary,
  slideLibrary,
  qrCodeLibrary,
  iconLibrary,
  deckCreationOpen,
  onDeckCreationOpen,
  onDeckCreationClose,
  selectedDeckId,
  user,
  onOpenDeck,
}: {
  section: WorkspaceSection;
  workspace: WorkspaceSummary;
  userEmail: string | null;
  navigate: (section: WorkspaceSection) => void;
  deckLibrary: ReturnType<typeof useDeckLibrary>;
  slideLibrary: ReturnType<typeof useSlideLibrary>;
  qrCodeLibrary: ReturnType<typeof useQrCodeLibrary>;
  iconLibrary: ReturnType<typeof useIconLibrary>;
  deckCreationOpen: boolean;
  onDeckCreationOpen: () => void;
  onDeckCreationClose: () => void;
  selectedDeckId: string | null;
  user: User;
  onOpenDeck: (deckId: string) => void;
}) {
  if (section === "decks") {
    if (selectedDeckId !== null) {
      if (selectedDeckId === "new") {
        return <DeckCreatePage library={deckLibrary} role={workspace.role} onBack={() => navigate("decks")} onCreated={onOpenDeck} />;
      }
      return (
        <DeckEditorPage
          user={user}
          workspaceId={workspace.id}
          deckId={selectedDeckId}
          role={workspace.role}
          onBack={() => navigate("decks")}
          onDuplicated={(deck) => {
            deckLibrary.acceptCreatedDeck(deck);
            onOpenDeck(deck.id);
          }}
          onUpdated={deckLibrary.acceptUpdatedDeck}
        />
      );
    }
    return (
      <DeckLibraryPage
        library={deckLibrary}
        role={workspace.role}
        creationOpen={deckCreationOpen}
        onCreationOpen={onDeckCreationOpen}
        onCreationClose={onDeckCreationClose}
        onOpenDeck={onOpenDeck}
      />
    );
  }

  if (section === "slides") {
    const editor = resolveWorkspaceResourceEditor(
      window.location.pathname,
      workspace.id,
      "slides",
    );
    if (editor?.mode === "new") {
      return (
        <SlideCreatePage
          library={slideLibrary}
          role={workspace.role}
          onBack={() => navigate("slides")}
        />
      );
    }
    return (
      <SlideLibraryPage
        library={slideLibrary}
        role={workspace.role}
        onCreatePage={() => {
          window.location.assign(
            workspaceResourceEditorPath(workspace.id, "slides", "new"),
          );
        }}
      />
    );
  }
  if (section === "qr-codes") {
    return <QrCodeLibraryPage library={qrCodeLibrary} role={workspace.role} />;
  }
  if (section === "icons") return <IconLibraryPage library={iconLibrary} role={workspace.role} />;

  if (section in RESOURCE_COPY) {
    return (
      <ResourcePage section={section as keyof typeof RESOURCE_COPY} />
    );
  }

  if (section === "members") {
    return (
      <>
        <header className="workspace-page-heading">
          <div>
            <p className="workspace-kicker">People and access</p>
            <h1>Members</h1>
            <p>Manage who can access this workspace and what they can do.</p>
          </div>
        </header>
        <section className="workspace-list-card">
          <div className="workspace-member-avatar" aria-hidden="true">
            {(userEmail?.[0] ?? "U").toUpperCase()}
          </div>
          <div>
            <strong>{userEmail ?? "Current user"}</strong>
            <span>Original workspace member</span>
          </div>
          <span className="workspace-role">{roleLabel(workspace.role)}</span>
        </section>
      </>
    );
  }

  if (section === "activity") {
    return <ActivityPage user={user} workspaceId={workspace.id} />;
  }

  if (section === "trash") {
    return (
      <>
        <header className="workspace-page-heading">
          <div>
            <p className="workspace-kicker">Recovery</p>
            <h1>Trash</h1>
            <p>Restore deleted resources before their retention period ends.</p>
          </div>
        </header>
        <section className="workspace-library-empty">
          <span className="workspace-empty-mark" aria-hidden="true">
            <NavigationGlyph section="trash" />
          </span>
          <h2>Trash is empty</h2>
          <p>Deleted workspace resources will appear here.</p>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="workspace-page-heading workspace-overview-heading">
        <div>
          <p className="workspace-kicker">Workspace overview</p>
          <h1>{workspace.name}</h1>
          <p>Your reusable presentation resources, all in one place.</p>
        </div>
        {workspace.role !== "viewer" && (
          <button type="button" onClick={onDeckCreationOpen}>
            New deck <span aria-hidden="true">→</span>
          </button>
        )}
      </header>

      <section className="workspace-stat-grid" aria-label="Workspace resources">
        {(["decks", "slides", "qr-codes", "icons"] as const).map((id) => {
          const item = WORKSPACE_NAVIGATION.find((entry) => entry.id === id);
          const count =
            id === "decks"
              ? deckLibrary.state.kind === "ready"
                ? deckLibrary.decks.length
                : "—"
                : id === "slides"
                ? slideLibrary.state.kind === "ready"
                  ? slideLibrary.slides.length
                  : "—"
                : id === "qr-codes"
                  ? qrCodeLibrary.status === "ready" ? qrCodeLibrary.codes.length : "—"
                  : id === "icons" ? iconLibrary.state === "ready" ? iconLibrary.icons.length : "—" : 0;
          return (
            <button key={id} type="button" onClick={() => navigate(id)}>
              <span className="workspace-stat-icon">
                <NavigationGlyph section={id} />
              </span>
              <strong>{count}</strong>
              <span>{item?.label}</span>
            </button>
          );
        })}
      </section>

      <div className="workspace-overview-grid">
        <section className="workspace-panel workspace-get-started">
          <p className="workspace-kicker">Get started</p>
          <h2>Build your first presentation</h2>
          <p>
            Decks bring reusable slides, QR codes, and icons together in one
            polished customer-facing loop.
          </p>
          <button type="button" onClick={onDeckCreationOpen}>
            Open decks <span aria-hidden="true">→</span>
          </button>
        </section>
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <p className="workspace-kicker">Activity history</p>
              <h2>Track workspace changes</h2>
            </div>
            <span className="workspace-activity-dot" aria-hidden="true" />
          </div>
          <p>See who created, updated, or copied workspace resources.</p>
          <button
            className="workspace-text-button"
            type="button"
            onClick={() => navigate("activity")}
          >
            View activity
          </button>
        </section>
      </div>
    </>
  );
}

export default function WorkspaceShell({
  workspace,
  workspaces,
  user,
  onWorkspaceChange,
  onSignOut,
}: WorkspaceShellProps) {
  const [section, setSection] = useState<WorkspaceSection>(() =>
    resolveWorkspaceSection(window.location.pathname),
  );
  const [deckCreationOpen, setDeckCreationOpen] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(() =>
    resolveWorkspaceDeckId(window.location.pathname, workspace.id),
  );
  const deckLibrary = useDeckLibrary(user, workspace.id);
  const slideLibrary = useSlideLibrary(user, workspace.id);
  const qrCodeLibrary = useQrCodeLibrary(user, workspace.id);
  const iconLibrary = useIconLibrary(user, workspace.id);

  useEffect(() => {
    function handleHistoryChange() {
      setSection(resolveWorkspaceSection(window.location.pathname));
      setSelectedDeckId(
        resolveWorkspaceDeckId(window.location.pathname, workspace.id),
      );
    }
    window.addEventListener("popstate", handleHistoryChange);
    return () => window.removeEventListener("popstate", handleHistoryChange);
  }, [workspace.id]);

  function navigate(nextSection: WorkspaceSection) {
    const path = workspaceSectionPath(workspace.id, nextSection);
    window.history.pushState({}, "", path);
    setSection(nextSection);
    setSelectedDeckId(null);
  }

  function openDeck(deckId: string) {
    window.history.pushState(
      {},
      "",
      workspaceDeckPath(workspace.id, deckId),
    );
    setSection("decks");
    setSelectedDeckId(deckId);
    setDeckCreationOpen(false);
  }

  function openDeckCreation() {
    if (workspace.role === "viewer") {
      navigate("decks");
      return;
    }
    deckLibrary.clearCreationError();
    openDeck("new");
  }

  function followNavigation(
    event: MouseEvent<HTMLAnchorElement>,
    nextSection: WorkspaceSection,
  ) {
    event.preventDefault();
    navigate(nextSection);
  }

  return (
    <main className="workspace-app-shell">
      <aside className="workspace-sidebar">
        <a className="workspace-brand" href="/">
          <span className="workspace-brand-mark" aria-hidden="true">
            Q
          </span>
          QRousel
        </a>

        <label className="workspace-switcher">
          <span>Workspace</span>
          <select
            value={workspace.id}
            onChange={(event) => {
              const selected = workspaces.find(
                (item) => item.id === event.target.value,
              );
              if (selected) {
                setSection("overview");
                setSelectedDeckId(null);
                setDeckCreationOpen(false);
                onWorkspaceChange(selected);
              }
            }}
          >
            {workspaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <nav className="workspace-navigation" aria-label="Workspace">
          {WORKSPACE_NAVIGATION.map((item) => (
            <a
              key={item.id}
              href={workspaceSectionPath(workspace.id, item.id)}
              aria-current={section === item.id ? "page" : undefined}
              onClick={(event) => followNavigation(event, item.id)}
            >
              <NavigationGlyph section={item.id} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="workspace-account">
          <span className="workspace-account-avatar" aria-hidden="true">
            {(user.email?.[0] ?? "U").toUpperCase()}
          </span>
          <div>
            <strong>{user.email ?? "Signed in"}</strong>
            <span>{roleLabel(workspace.role)}</span>
          </div>
          <button type="button" onClick={() => void onSignOut()}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="workspace-main-column">
        <header className="workspace-mobile-header">
          <a className="workspace-brand" href="/">
            <span className="workspace-brand-mark" aria-hidden="true">
              Q
            </span>
            QRousel
          </a>
          <div>
            <span>{workspace.name}</span>
            <button type="button" onClick={() => void onSignOut()}>
              Sign out
            </button>
          </div>
        </header>
        <section className="workspace-page">
          <WorkspacePage
            section={section}
            workspace={workspace}
            userEmail={user.email}
            navigate={navigate}
            deckLibrary={deckLibrary}
            slideLibrary={slideLibrary}
            qrCodeLibrary={qrCodeLibrary}
            iconLibrary={iconLibrary}
            deckCreationOpen={deckCreationOpen}
            onDeckCreationOpen={openDeckCreation}
            onDeckCreationClose={() => setDeckCreationOpen(false)}
            selectedDeckId={selectedDeckId}
            user={user}
            onOpenDeck={openDeck}
          />
        </section>
      </div>
    </main>
  );
}
