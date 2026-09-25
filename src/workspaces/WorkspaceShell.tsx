import { useEffect, useState, type MouseEvent } from "react";
import type { User } from "firebase/auth";
import { deleteAccount } from "../auth/delete-account-client";
import { markWorkspaceNotificationRead, requestWorkspaceNotifications, type WorkspaceNotification } from "./notification-client";
import { DECK_LIMIT } from "../../lib/decks/creation";
import { SLIDE_LIMIT } from "../../lib/slides/creation";
import { QR_CODE_LIMIT } from "../../lib/qr-codes/creation";
import { ICON_LIMIT } from "../../lib/icons/creation";
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
import SlideEditPage from "../slides/SlideEditPage";
import { useSlideLibrary } from "../slides/use-slide-library";
import QrCodeLibraryPage from "../qr-codes/QrCodeLibraryPage";
import QrCodeCreatePage from "../qr-codes/QrCodeCreatePage";
import QrCodeEditPage from "../qr-codes/QrCodeEditPage";
import { useQrCodeLibrary } from "../qr-codes/use-qr-code-library";
import IconLibraryPage from "../icons/IconLibraryPage";
import IconCreatePage from "../icons/IconCreatePage";
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
import { createInvitation, requestInvitations, type WorkspaceInvitation } from "./invitation-client";
import { requestMembers, revokeMember, transferFounder, updateMemberRole, type WorkspaceMember } from "./members-client";
import { deleteResource, requestTrash, restoreResource, type TrashItem } from "./trash-client";

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
          onOpenSlideLibrary={() => navigate("slides")}
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
          qrCodes={qrCodeLibrary.codes}
          onBack={() => navigate("slides")}
        />
      );
    }
    if (editor?.mode === "edit") {
      const slide = slideLibrary.slides.find((item) => item.id === editor.resourceId);
      if (slide) return <SlideEditPage library={slideLibrary} role={workspace.role} slide={slide} qrCodes={qrCodeLibrary.codes} onBack={() => navigate("slides")} />;
    }
    return (
      <SlideLibraryPage
        library={slideLibrary}
        role={workspace.role}
        user={user}
        workspaceId={workspace.id}
        onOpenDeck={onOpenDeck}
        onCreatePage={() => {
          window.history.pushState({}, "", workspaceResourceEditorPath(workspace.id, "slides", "new"));
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
        onEditPage={(slideId) => { window.history.pushState({}, "", workspaceResourceEditorPath(workspace.id, "slides", "edit", slideId)); window.dispatchEvent(new PopStateEvent("popstate")); }}
      />
    );
  }
  if (section === "qr-codes") {
    const editor = resolveWorkspaceResourceEditor(
      window.location.pathname,
      workspace.id,
      "qr-codes",
    );
    if (editor?.mode === "new") {
      return (
        <QrCodeCreatePage
          library={qrCodeLibrary}
          role={workspace.role}
          icons={iconLibrary.icons}
          onBack={() => navigate("qr-codes")}
        />
      );
    }
    if (editor?.mode === "edit") {
      const code = qrCodeLibrary.codes.find((item) => item.id === editor.resourceId);
      if (code) return <QrCodeEditPage library={qrCodeLibrary} role={workspace.role} code={code} icons={iconLibrary.icons} user={user} workspaceId={workspace.id} onBack={() => navigate("qr-codes")} />;
    }
    return (
      <QrCodeLibraryPage
        library={qrCodeLibrary}
        role={workspace.role}
        icons={iconLibrary.icons}
        user={user}
        workspaceId={workspace.id}
        onCreatePage={() =>
          { window.history.pushState({}, "", workspaceResourceEditorPath(workspace.id, "qr-codes", "new")); window.dispatchEvent(new PopStateEvent("popstate")); }
        }
        onEditPage={(qrCodeId) => { window.history.pushState({}, "", workspaceResourceEditorPath(workspace.id, "qr-codes", "edit", qrCodeId)); window.dispatchEvent(new PopStateEvent("popstate")); }}
      />
    );
  }
  if (section === "icons") {
    const editor = resolveWorkspaceResourceEditor(window.location.pathname, workspace.id, "icons");
    if (editor?.mode === "new") return <IconCreatePage library={iconLibrary} role={workspace.role} onBack={() => navigate("icons")} />;
    return <IconLibraryPage library={iconLibrary} role={workspace.role} user={user} workspaceId={workspace.id} onCreatePage={() => { window.history.pushState({}, "", workspaceResourceEditorPath(workspace.id, "icons", "new")); window.dispatchEvent(new PopStateEvent("popstate")); }} />;
  }

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
        <MembersPanel user={user} workspaceId={workspace.id} actorRole={workspace.role} />
      </>
    );
  }

  if (section === "activity") {
    return <ActivityPage user={user} workspaceId={workspace.id} />;
  }

  if (section === "trash") {
    return <TrashPage user={user} workspaceId={workspace.id} role={workspace.role} />;
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
          const limit = id === "decks" ? DECK_LIMIT : id === "slides" ? SLIDE_LIMIT : id === "qr-codes" ? QR_CODE_LIMIT : ICON_LIMIT;
          return (
            <button key={id} type="button" onClick={() => navigate(id)}>
              <span className="workspace-stat-icon">
                <NavigationGlyph section={id} />
              </span>
              <strong>{count}<small> / {limit}</small></strong>
              <span>{item?.label} in use</span>
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
        {workspace.role === "founder" && <section className="workspace-panel"><p className="workspace-kicker">Danger zone</p><h2>Archive workspace</h2><p>Archive this workspace and remove it from every member’s workspace list.</p><button type="button" onClick={async () => { const confirmation = window.prompt(`Type “${workspace.name}” to archive this workspace.`); if (confirmation !== workspace.name) return; const response = await fetch("/api/workspaces", { method: "DELETE", headers: { authorization: `Bearer ${await user.getIdToken()}`, "content-type": "application/json" }, body: JSON.stringify({ workspaceId: workspace.id, confirmation }) }); if (response.ok) window.location.assign("/app"); }}>Archive workspace</button></section>}
      </div>
    </>
  );
}

function manageableRoles(role: WorkspaceRole): Exclude<WorkspaceRole, "founder">[] { return role === "founder" ? ["owner", "admin", "editor", "viewer"] : role === "owner" ? ["admin", "editor", "viewer"] : role === "admin" ? ["editor", "viewer"] : []; }
function MembersPanel({ user, workspaceId, actorRole }: { user: User; workspaceId: string; actorRole: WorkspaceRole }) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]); const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]); const [error, setError] = useState(""); const [busyUid, setBusyUid] = useState("");
  const roles = manageableRoles(actorRole); const canManage = roles.length > 0;
  useEffect(() => { let active = true; void Promise.all([requestMembers(user, workspaceId), canManage ? requestInvitations(user, workspaceId) : Promise.resolve([])]).then(([nextMembers, nextInvitations]) => { if (active) { setMembers(nextMembers); setInvitations(nextInvitations); } }, (reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "QRousel could not load workspace access."); }); return () => { active = false; }; }, [canManage, user, workspaceId]);
  async function changeRole(member: WorkspaceMember, role: Exclude<WorkspaceRole, "founder">) { setBusyUid(member.uid); setError(""); try { await updateMemberRole(user, workspaceId, member.uid, role); setMembers((items) => items.map((item) => item.uid === member.uid ? { ...item, role } : item)); } catch (reason) { setError(reason instanceof Error ? reason.message : "QRousel could not change this role."); } finally { setBusyUid(""); } }
  async function remove(member: WorkspaceMember) { if (!window.confirm(`Remove ${member.email ?? member.displayName ?? "this member"} from the workspace?`)) return; setBusyUid(member.uid); setError(""); try { await revokeMember(user, workspaceId, member.uid); setMembers((items) => items.filter((item) => item.uid !== member.uid)); } catch (reason) { setError(reason instanceof Error ? reason.message : "QRousel could not remove this member."); } finally { setBusyUid(""); } }
  async function handoff(member: WorkspaceMember) { if (!window.confirm(`Transfer founder responsibility to ${member.email ?? member.displayName}? You will become an owner.`)) return; setBusyUid(member.uid); try { await transferFounder(user, workspaceId, member.uid); window.location.reload(); } catch (reason) { setError(reason instanceof Error ? reason.message : "QRousel could not transfer founder responsibility."); } finally { setBusyUid(""); } }
  return <><section className="workspace-member-list">{members.map((member) => { const canEdit = roles.includes(member.role as Exclude<WorkspaceRole, "founder">) && member.uid !== user.uid; return <article className="workspace-list-card" key={member.uid}><div className="workspace-member-avatar" aria-hidden="true">{(member.displayName?.[0] ?? member.email?.[0] ?? "U").toUpperCase()}</div><div><strong>{member.displayName ?? member.email ?? "Workspace member"}</strong><span>{member.email ?? "No email available"}</span></div>{canEdit ? <><select value={member.role} disabled={busyUid === member.uid} onChange={(event) => void changeRole(member, event.target.value as Exclude<WorkspaceRole, "founder">)}>{roles.map((role) => <option key={role}>{role}</option>)}</select><button className="workspace-text-button" type="button" disabled={busyUid === member.uid} onClick={() => void remove(member)}>Remove</button>{actorRole === "founder" && <button className="workspace-text-button" type="button" disabled={busyUid === member.uid} onClick={() => void handoff(member)}>Make founder</button>}</> : <span className="workspace-role">{roleLabel(member.role)}</span>}</article>; })}</section>{error && <p className="auth-error" role="alert">{error}</p>}{canManage && <InvitePanel user={user} workspaceId={workspaceId} roles={roles} onCreated={(invitation) => setInvitations((items) => [invitation, ...items])} />}{canManage && <section className="workspace-invitation-status"><h2>Invitation status</h2>{invitations.length === 0 ? <p>No invitation links yet.</p> : <ul>{invitations.map((invitation) => <li key={invitation.token}><span>{roleLabel(invitation.role)}</span><span>{invitation.status === "active" ? "Ready to use" : "Used"}</span></li>)}</ul>}</section>}</>;
}
function InvitePanel({ user, workspaceId, roles, onCreated }: { user: User; workspaceId: string; roles: Exclude<WorkspaceRole, "founder">[]; onCreated: (invitation: WorkspaceInvitation) => void }) {
  const [role, setRole] = useState<Exclude<WorkspaceRole, "founder">>(roles.includes("editor") ? "editor" : roles[0]);
  const [link, setLink] = useState(""); const [email, setEmail] = useState(""); const [error, setError] = useState(""); const [delivery, setDelivery] = useState("");
  async function create() { setError(""); setDelivery(""); try { const invitation = await createInvitation(user, workspaceId, role, email); setLink(`${window.location.origin}/app?invite=${encodeURIComponent(invitation.token)}`); onCreated({ token: invitation.token, role, status: "active" }); if (invitation.emailDelivery === "sent") setDelivery("Invitation email sent."); else if (email.trim()) setDelivery("Email was not sent. Use the single-use link below."); } catch (reason) { setError(reason instanceof Error ? reason.message : "QRousel could not create an invitation."); } }
  return <section className="workspace-list-card invite-panel"><div><strong>Invite a member</strong><span>Email delivery is optional; every invitation also has a single-use link.</span></div><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@example.com (optional)" /><select value={role} onChange={(event) => setRole(event.target.value as Exclude<WorkspaceRole, "founder">)}>{roles.map((item) => <option key={item}>{item}</option>)}</select><button type="button" onClick={() => void create()}>Create invitation</button>{delivery && <p>{delivery}</p>}{link && <label><span>Single-use link</span><input readOnly value={link} onFocus={(event) => event.currentTarget.select()} /></label>}{error && <p className="auth-error">{error}</p>}</section>;
}

function TrashPage({ user, workspaceId, role }: { user: User; workspaceId: string; role: WorkspaceRole }) {
  const [items, setItems] = useState<TrashItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [busyId, setBusyId] = useState("");
  useEffect(() => { let active = true; void requestTrash(user, workspaceId).then((next) => { if (active) { setItems(next); setLoading(false); } }, (reason: unknown) => { if (active) { setError(reason instanceof Error ? reason.message : "QRousel could not load trash."); setLoading(false); } }); return () => { active = false; }; }, [user, workspaceId]);
  async function restore(item: TrashItem) { setBusyId(item.id); setError(""); try { await restoreResource(user, workspaceId, item.type, item.id); setItems((current) => current.filter((candidate) => candidate.id !== item.id)); } catch (reason) { setError(reason instanceof Error ? reason.message : "QRousel could not restore this resource."); } finally { setBusyId(""); } }
  async function remove(item: TrashItem) { if (!window.confirm(`Permanently delete “${item.name}”? This cannot be undone.`)) return; setBusyId(item.id); setError(""); try { await deleteResource(user, workspaceId, item.type, item.id); setItems((current) => current.filter((candidate) => candidate.id !== item.id)); } catch (reason) { setError(reason instanceof Error ? reason.message : "QRousel could not permanently delete this resource."); } finally { setBusyId(""); } }
  return <><header className="workspace-page-heading"><div><p className="workspace-kicker">Recovery</p><h1>Trash</h1><p>Restore archived resources, or permanently delete them if you are the founder.</p></div></header>{loading && <section className="workspace-library-empty"><p>Loading trash…</p></section>}{!loading && items.length === 0 && <section className="workspace-library-empty"><span className="workspace-empty-mark" aria-hidden="true"><NavigationGlyph section="trash" /></span><h2>Trash is empty</h2><p>Archived workspace resources will appear here.</p></section>}{!loading && items.length > 0 && <section className="workspace-member-list">{items.map((item) => <article className="workspace-list-card" key={`${item.type}-${item.id}`}><div><strong>{item.name}</strong><span>{item.type.replace("-", " ")}</span></div><button type="button" disabled={busyId === item.id} onClick={() => void restore(item)}>Restore</button>{role === "founder" && <button className="workspace-text-button" type="button" disabled={busyId === item.id} onClick={() => void remove(item)}>Delete forever</button>}</article>)}</section>}{error && <p className="auth-error" role="alert">{error}</p>}</>;
}

export default function WorkspaceShell({
  workspace,
  workspaces,
  user,
  onWorkspaceChange,
  onSignOut,
}: WorkspaceShellProps) {
  const [accountDeletionError, setAccountDeletionError] = useState("");
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [section, setSection] = useState<WorkspaceSection>(() =>
    resolveWorkspaceSection(window.location.pathname),
  );
  const [deckCreationOpen, setDeckCreationOpen] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(() =>
    resolveWorkspaceDeckId(window.location.pathname, workspace.id),
  );
  const [, setRouteRevision] = useState(0);
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
      setRouteRevision((revision) => revision + 1);
    }
    window.addEventListener("popstate", handleHistoryChange);
    return () => window.removeEventListener("popstate", handleHistoryChange);
  }, [workspace.id]);

  useEffect(() => {
    let current = true;
    void requestWorkspaceNotifications(user, workspace.id).then(
      (items) => { if (current) setNotifications(items); },
      () => { if (current) setNotifications([]); },
    );
    return () => { current = false; };
  }, [user, workspace.id]);

  function navigate(nextSection: WorkspaceSection) {
    const path = workspaceSectionPath(workspace.id, nextSection);
    window.history.pushState({}, "", path);
    setSection(nextSection);
    setSelectedDeckId(null);
    setRouteRevision((revision) => revision + 1);
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

  async function removeAccount() {
    const confirmation = window.prompt(
      "Type DELETE MY ACCOUNT to permanently delete your QRousel account.",
    );
    if (confirmation !== "DELETE MY ACCOUNT") return;
    setAccountDeletionError("");
    try {
      await deleteAccount(user);
      await onSignOut();
      window.location.assign("/");
    } catch (reason) {
      setAccountDeletionError(
        reason instanceof Error ? reason.message : "QRousel could not delete this account.",
      );
    }
  }

  async function dismissNotification(notification: WorkspaceNotification) {
    setNotifications((items) => items.filter((item) => item.id !== notification.id));
    try {
      await markWorkspaceNotificationRead(user, workspace.id, notification.id);
    } catch {
      setNotifications((items) => [notification, ...items]);
    }
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
          <button className="workspace-text-button" type="button" onClick={() => void removeAccount()}>
            Delete account
          </button>
          {accountDeletionError && <p className="auth-error" role="alert">{accountDeletionError}</p>}
        </div>
      </aside>

      <div className="workspace-main-column">
        {notifications.map((notification) => (
          <section className="workspace-notice" role="status" key={notification.id}>
            <div><strong>Workspace founder changed</strong><p>{notification.message}</p></div>
            <button type="button" onClick={() => void dismissNotification(notification)}>Got it</button>
          </section>
        ))}
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
            <button className="workspace-text-button" type="button" onClick={() => void removeAccount()}>
              Delete account
            </button>
            {accountDeletionError && <p className="auth-error" role="alert">{accountDeletionError}</p>}
          </div>
        </header>
        <section className="workspace-page">
          <WorkspacePage
            section={section}
            workspace={workspace}
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
