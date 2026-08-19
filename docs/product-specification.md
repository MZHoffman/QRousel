# QRousel Product Specification

**Status:** Frozen for implementation

**Version:** 1.0

**Agreed:** 19 August 2026

**PR scope:** Documentation only

## 1. Product summary

QRousel is a multi-tenant web application for creating, managing, publishing,
and presenting reusable QR-code slides.

People work inside isolated workspaces. Each workspace owns reusable icons, QR
codes, slides, and decks. A deck can be published to a clean customer-facing
presentation that advances automatically, supports immediate keyboard
navigation, and can continue playing after its published data has loaded.

The first release is a free beta with strict service and product limits. It
must not require a payment method for Firebase or Netlify and must prefer
service suspension or feature degradation over unexpected charges.

## 2. Product goals

- Preserve the current clean presentation experience.
- Let users reuse workspace resources instead of recreating them per deck.
- Make the impact of editing shared resources explicit before saving.
- Support multiple workspaces, invitations, and role-based access.
- Keep published presentations stable until deliberately republished.
- Generate styled, scannable QR codes from structured payloads.
- Offer optional, privacy-minimal analytics for trackable QR codes.
- Keep all infrastructure within hard free-tier constraints for the beta.
- Maintain an understandable history of changes and allow safe restoration.

## 3. Explicit non-goals for the first release

- Customer billing, subscriptions, or paid plans
- Native mobile applications
- Password or passwordless-email authentication
- SMS QR payloads
- Real-time collaborative editing
- Dynamic custom permission builders
- Custom presentation CSS
- Presentation-view analytics
- Full workspace import
- Identifying, fingerprinting, or tracking individual QR scanners

## 4. Domain language

### Account

An admitted QRousel user profile associated with a Google-authenticated user.
Only admitted profiles count toward the 200-account beta limit.

### Workspace

The customer-facing name for a tenant. A workspace is the isolation and
ownership boundary for members, icons, QR codes, slides, decks, activity,
revisions, publications, and trash.

### Founder

A protected workspace Owner. A workspace has exactly one Founder. The Founder
cannot be removed or downgraded by another member but can voluntarily transfer
Founder status.

### Icon

A reusable processed image that can be embedded in the center of a QR code.
Its original upload, crop configuration, and processed result belong to the
workspace.

### QR code

A reusable QR definition containing a typed payload and visual settings. A QR
code may reference one workspace icon.

### Slide

A reusable presentation unit containing a title, description, and reference
to one workspace QR code.

### Deck

An ordered presentation containing references to reusable workspace slides.

### Deck placement

The occurrence of a slide inside a deck. Ordering and duration overrides
belong to the placement, not to the reusable slide.

### Publication

The single current immutable snapshot served by a deck's public presentation
link. Republishing replaces the current snapshot at the same link.

### Recorded open

A request received by a Trackable QR redirect. It is an estimated scan, not a
guaranteed human scan, because bots and security scanners can also open links.

## 5. Resource model

```text
Account
└── Workspace membership + role
    └── Workspace
        ├── Members and invitations
        ├── Icon library
        ├── QR library ── references an icon
        ├── Slide library ── references a QR code
        ├── Deck library ── ordered references to slides
        ├── Activity and revisions
        ├── Publications
        └── Trash
```

Every owned resource belongs to exactly one workspace. A resource cannot
reference a resource from another workspace.

Each resource section has its own search, sorting, and filters. There is no
combined global library in the first release.

## 6. Beta limits

| Limit | Value |
| --- | ---: |
| Active admitted QRousel accounts | 200 globally |
| Workspaces one account may create | 5 |
| Members in one workspace | 20 |
| Decks in one workspace | 100 |
| Slides in one workspace | 500 |
| QR codes in one workspace | 500 |
| Icons in one workspace | 100 |
| Slides placed in one deck | 50 |
| Original uploaded image | 5 MB |
| Detailed recorded opens per Trackable QR | Latest 1,000 |
| Invitation emails | 10/day and 100/month globally |
| Invitation lifetime | 7 days |
| Trash retention | 90 days maximum |
| Recoverable workspace deletion | 30 days |

Active, archived, and trashed resources count toward their resource limit.
Duplicates and preset icons copied into a workspace also count.

Deleted accounts do not count toward the 200-account limit. Suspended accounts
continue to count.

## 7. Authentication and account admission

- Google is the only sign-in method in the first release.
- Successful Google authentication does not by itself grant application
  access. The user must also have an admitted QRousel account profile.
- Account admission uses an authoritative application counter and stops at
  200 active admitted accounts.
- Notify the operator at 150, 180, 195, and 200 active accounts.
- At capacity, disable registration and show `Beta capacity reached`.
- Existing accounts continue to sign in at capacity.
- Existing accounts may still join additional workspaces at capacity.
- Invitations for new people cannot be accepted until capacity is available.
- Deleting an account frees one account place.

The cap is enforced at the application-profile boundary because strict
pre-creation Firebase Authentication blocking requires paid infrastructure.
An unusable Firebase Authentication record created outside the application
does not become an admitted QRousel account and receives no workspace access.

## 8. Workspaces, membership, and roles

### Role capabilities

| Capability | Founder | Owner | Admin | Editor | Viewer |
| --- | :---: | :---: | :---: | :---: | :---: |
| View workspace content | Yes | Yes | Yes | Yes | Yes |
| Run presentations | Yes | Yes | Yes | Yes | Yes |
| Create and edit content | Yes | Yes | Yes | Yes | No |
| Archive permitted content | Yes | Yes | Yes | Yes | No |
| Publish decks | Yes | Yes | Yes | Yes | No |
| Manage invitations and members | Yes | Yes | Yes | No | No |
| Change non-Founder roles | Yes | Yes | Yes | No | No |
| Permanently delete individual trash | Yes | Yes | No | No | No |
| Empty trash manually | Yes | Yes | No | No | No |
| Transfer Founder status | Yes | No | No | No | No |
| Delete the workspace | Yes | No | No | No | No |
| Export the complete workspace | Yes | No | No | No | No |

### Founder rules

- The workspace creator initially becomes Founder.
- Other Owners cannot remove or downgrade the Founder.
- The Founder may voluntarily transfer Founder status after reauthentication.
- After transfer, the former Founder becomes an ordinary Owner and may then be
  removed or downgraded normally.
- If the Founder deletes their account, Founder status passes deterministically
  to the oldest existing Owner, otherwise the oldest Admin, otherwise the
  oldest Viewer.
- The succession event is recorded in workspace activity.
- Every remaining member receives a one-time popup on next login naming the
  departed Founder and the successor.
- If no other member exists, deleting the Founder's account puts the workspace
  into a 30-day recoverable deletion state.

## 9. Invitations

- Owners and Admins may invite people and choose their initial role.
- Invitations are bound to the invited email address.
- Acceptance requires Google sign-in with the invited address.
- An invitation can survive registration for a person without an account.
- Invitations expire after seven days and are single-use.
- Invitations can be revoked and resent.
- The invitation email allowance is capped by QRousel at 10 daily and 100
  monthly, below the external provider's allowance.
- Every invitation provides a copyable link so it can be shared manually.
- If email delivery or its quota fails, copy-link invitations remain available.

## 10. Resource editing rules

- Resource forms use explicit `Save`, `Save as copy`, and `Cancel` actions.
- The first release does not autosave shared-resource edits.
- Before changing a shared icon, QR code, or slide, show an impact summary such
  as `This affects 4 QR codes, 9 slides, and 3 decks`.
- The summary can expand to list affected resources.
- `Update everywhere` saves the shared edit.
- `Save as copy` creates a new resource and updates only the current context.
- If a resource changed after an editor opened it, do not silently overwrite
  it. Offer reload, compare, or save as a copy.
- Show `Used in` relationships before archiving, restoring, or deleting shared
  resources.

## 11. Duplication

Icons, QR codes, slides, and decks can all be duplicated.

Deck duplication offers two modes:

1. **Duplicate structure:** create a new deck referencing the same reusable
   slides.
2. **Independent duplicate:** copy every slide for independent editing while
   initially retaining references to the same QR codes and icons.

Independent duplicate is the recommended default when the purpose is to make
a variation without changing the original deck.

## 12. Icon library

### Preset icons

- The initial curated presets include WhatsApp, X, LinkedIn, YouTube,
  Instagram, Bluesky, AsyncAPI, CityJS London, CityJS Athens, and JS Monthly.
- Presets appear as available choices from the start.
- A preset is copied into a workspace on first use rather than pre-populating
  every workspace.
- After copying, it behaves like a normal workspace icon and can be edited,
  duplicated, archived, restored, or deleted according to normal rules.

### Uploaded icons

- Accept PNG, JPEG, WebP, and sanitized SVG images.
- Accept both file upload and image paste from the clipboard.
- Keep the original privately so the crop can be changed later.
- Store crop coordinates and settings separately from the original.
- Produce a reusable processed PNG that preserves transparency where possible.
- Support manual move, crop, and edge/corner resize.
- Support free, 1:1, 4:3, 3:4, 4:5, 16:9, and 9:16 crop ratios.
- Support automatic trimming of excess background with a manual reset.
- Show a processed-icon preview and estimated output size.
- Allow the cropped result to be downloaded independently.
- Retain adjustable export quality/compression where the selected image format
  supports it.
- Cropping icons and creating QR codes are separate workflows.

The implementation may reuse the behavior of the supplied QR/crop example but
must not copy its visual styling or forced icon-to-QR wizard layout.

## 13. QR-code library

### Payload types

- Secure website URL
- Email
- Telephone
- Wi-Fi credentials
- Plain text

SMS payloads are deferred.

### QR fields

- Name
- Typed destination input and final encoded payload
- Optional icon reference
- QR foreground color
- Density/version, defaulting to Auto
- Icon scale
- Generated preview
- Created and updated metadata

### Rendering behavior

- Use high error correction when embedding an icon.
- Maintain a standards-safe quiet zone.
- Use automatic density by default and retain manual density as an advanced
  control.
- If a chosen density cannot contain the payload, safely fall back to an
  adequate automatic density.
- Show an icon-size scan-risk assessment.
- Preserve the supplied generator's connected-square module treatment and
  custom rounded finder-eye treatment unless scan validation shows that a
  rendering choice is unsafe.
- Decode-test the completed QR before allowing it to be saved or published.
- Block saving or publishing when the completed QR cannot be decoded reliably.
- Produce a high-resolution preview and download of at least 1024 × 1024.
- Show estimated output size and retain adjustable download
  quality/compression where the selected image format supports it.
- Generate a safe download filename from the QR name or destination.

### Direct and Trackable QR codes

**Direct QR** encodes the final destination. It does not provide analytics and
does not depend on QRousel after generation. Editing its destination changes
the rendered QR graphic.

**Trackable QR** encodes a QRousel redirect. It supports recorded-open
analytics and permits the destination to change without changing the QR
graphic. It depends on QRousel and Netlify being available.

Direct is the default because it is the more reliable mode.

## 14. Trackable QR analytics

Each Trackable QR redirect creates a small Firestore scan document with:

- A random event ID unrelated to a person
- The parent QR identifier
- A server-generated UTC timestamp
- The destination revision used for the redirect

Each QR also keeps:

- Lifetime recorded-open count
- First recorded-open timestamp
- Last recorded-open timestamp
- Count of currently retained detailed events

Retain only the latest 1,000 detailed events per QR. When event 1,001 is
recorded, permanently remove the oldest detailed event while preserving the
lifetime total and first/last counters.

The analytics interface may derive chronological logs and hourly, daily, or
period totals from the retained timestamps.

Do not store scanner names, account IDs, IP addresses, cookies, persistent
visitor IDs, browser fingerprints, device details, precise location, or
referrer URLs. QRousel cannot identify a scanner or determine whether two
recorded opens came from the same person.

Do not show a scanner a popup, consent prompt, cookie banner, or intermediate
analytics page. The redirect is immediate. Publish a general QRousel privacy
page describing the anonymous recorded-open behavior.

Analytics are best-effort. If recording fails, attempt the redirect anyway.
The UI must describe these as recorded opens or estimated scans rather than
guaranteed human scans.

## 15. Slide library

- A slide contains a title, description, and reference to one QR code.
- Slides are reusable across every deck in the same workspace.
- Editing a shared slide updates every draft deck that references it after the
  editor confirms the impact warning.
- A slide can be duplicated to create an independent variation.
- Slide search and filters are scoped to the slide section.
- A workspace may contain up to 500 active, archived, and trashed slides.

## 16. Deck library and editor

- A workspace may contain up to 100 decks.
- A deck contains up to 50 ordered slide placements.
- Slides can be added from the workspace slide library.
- Arrange placements with drag-and-drop and accessible Move up/Move down
  actions.
- The deck-wide default display duration starts at 15 seconds.
- The deck editor can change that default for all non-overridden placements.
- Each placement may override its duration without modifying the reusable
  slide or another deck's placement.
- Deck search and filters are scoped to the deck section.

## 17. Drafts, publishing, and public access

- Editing occurs in a draft deck.
- The public presentation displays only the current published snapshot.
- Publishing captures all slide, QR, icon, ordering, and timing data required
  to play that deck independently of later draft edits.
- Editing a shared resource updates affected draft decks but does not change an
  existing publication until the deck is republished.
- Republishing replaces the publication under the same public link.
- Visitors cannot select or access older publications.
- A deck can be private, public with an unguessable link, or public with a
  passcode.
- Permitted publishers can disable or regenerate a link. Regeneration
  immediately invalidates the old link.
- Public visitors can access only the published player, never workspace
  libraries, drafts, membership, or management data.

## 18. Presentation player

- Start cycling automatically after the published snapshot and its assets load.
- Display the QR code on the left and title/description on the right on wide
  displays.
- Display the QR code above the title/description on narrow phone screens.
- Show only customer-facing slide content and the bottom countdown bar.
- Do not show pause, back, forward, edit, management, or other visible controls.
- Support Left and Right arrow keys for immediate navigation.
- Reset the current placement timer after manual navigation.
- After initial loading, continue playing from browser memory when the network
  temporarily disappears.
- Do not poll for publication changes during playback.
- Refreshing the page loads the latest published snapshot.
- Optimize the player for desktop, tablet, and TV; maintain a usable responsive
  phone layout.
- Offer optional Reduced motion and High contrast settings, both off by default
  and low priority for the first release.

Management belongs in the authenticated dashboard. The multi-tenant product
does not use the original invisible whole-page management overlay.

## 19. Archive, Trash, and permanent deletion

### Archive

- Archived resources disappear from new-resource selectors and default search.
- Existing references and published snapshots continue to work.
- Archived resources count toward limits.

### Trash

- Trashed resources remain recoverable for up to 90 days.
- Trashed resources count toward limits.
- Show dependency requirements when restoring a resource.
- Offer to restore required trashed dependencies together; never silently
  restore them or leave the restored resource broken.
- Owners can manually permanently delete individual trash items or empty the
  Trash.
- The system permanently removes items after 90 days.

### Capacity-triggered eviction

When creating a resource at its limit, the system may permanently remove the
oldest same-type trashed resources early to free the required capacity. Any
member allowed to create that resource can indirectly trigger this cleanup.

This creates a known quota-flooding risk: a malicious or careless creator could
force earlier trash deletion by repeatedly creating resources. Accept this for
the beta, do not advertise it as a feature, and revisit it before broad public
adoption.

## 20. Activity and revision history

### Activity

Record create, edit, copy, archive, restore, trash, permanent delete, publish,
invitation, role, membership, ownership, and workspace lifecycle events.

Each event contains:

- Actor, or an anonymized deleted-user label
- Action
- Resource identity and type
- Server timestamp
- Concise field-level change summary

Do not log image binaries, invitation secrets, passcodes, or ordinary resource
views.

Every workspace member can view activity. Nobody, including the Founder, can
edit or delete activity entries.

### Revisions and undo

- Maintain lightweight revisions for icons, QR codes, slides, and decks.
- Restoring an earlier state creates a new current revision.
- Restoration appends a new activity event and never rewrites history.
- Activity history explains what happened; revisions contain restorable state.

## 21. Dashboard and notifications

After sign-in:

- A user with one workspace enters it directly.
- A user with several workspaces sees a workspace chooser.
- Keep a persistent workspace switcher in the dashboard.

The workspace dashboard shows:

- Recently edited decks
- Draft and published status
- Resources approaching their limits
- Pending invitations
- Recent activity
- A prominent New deck action

Send email only for invitations, ownership transfer, workspace deletion, and
security-sensitive role changes. Use in-app feedback for ordinary edits,
publishing, archiving, restoration, and capacity information.

## 22. Search and sorting

Icons, QR codes, slides, and decks each provide their own:

- Name search
- Active, archived, and trashed filters as appropriate
- Name, created, updated, and recently used sorting

Do not add folders or a combined global resource library initially.

## 23. Workspace export

The Founder can export a ZIP containing:

- Structured workspace JSON
- Original uploaded icons
- Processed icon assets
- Generated QR images
- Deck, slide, resource, membership, revision, and publication metadata that is
  safe and appropriate to export

Full workspace import is deferred.

## 24. Infrastructure constraints

### Netlify Free

- Hosts the frontend.
- Runs privileged Netlify Functions.
- Stores original and processed media in Netlify Blobs.
- Uses the Free plan's hard monthly limit with no automatic recharge.
- If the allowance is exhausted, suspension is preferable to a charge.

### Firebase Spark

- Firebase Authentication provides Google identity.
- Cloud Firestore stores workspaces, memberships, content, revisions,
  publications, activity, limits, and recorded-open events.
- Do not use Firebase Cloud Storage, Firebase Cloud Functions, Authentication
  blocking functions, or Identity Platform in the free beta.
- Attach no Firebase billing account.

### Resend Free

- Sends invitation and sensitive-account emails through Netlify Functions.
- QRousel enforces stricter application limits of 10 invitation emails daily
  and 100 monthly.
- Manual copy-link invitations remain available if email is unavailable.

Privileged writes, invitation handling, publication, auditing, quota cleanup,
and permanent deletion run through trusted Netlify Function boundaries rather
than trusting client-side enforcement.

## 25. Security requirements

- Deny access by default in Firestore rules.
- Verify Google authentication and admitted QRousel profile status.
- Enforce workspace membership and roles for every private operation.
- Validate that every referenced resource belongs to the same workspace.
- Prevent clients from changing Founder status, counters, activity, revisions,
  ownership metadata, or publication state directly.
- Sanitize uploaded SVG content.
- Store invitation tokens and deck passcodes securely; do not store plaintext
  secrets in activity.
- Use server timestamps for authoritative history and analytics.
- Test Firestore Rules and trusted function authorization automatically.
- Public routes expose only the minimum published or redirect data required.

## 26. Known beta risks and constraints

- Trackable QR codes depend on Netlify and QRousel availability; Direct QR
  codes do not.
- A full Netlify Free suspension can interrupt public presentations and
  Trackable QR redirects until the allowance resets.
- Firebase Spark and Netlify Free quotas can degrade or pause features but must
  not generate charges.
- Application admission prevents more than 200 usable QRousel accounts, but
  without paid Authentication blocking it cannot guarantee that no unusable
  Firebase Authentication record is created externally.
- Recorded opens can include bots and security scanners.
- Exact recorded-open timestamps may be sensitive when combined with outside
  information even though QRousel stores no scanner identifier.
- Capacity-triggered Trash eviction can be induced by resource flooding.
- Google-only authentication excludes people without an acceptable Google
  account.
- Free transactional email quotas can delay invitation delivery.
- The free beta has no uptime or support SLA.

## 27. Delivery principles

- Build and merge one independently reviewable feature PR at a time.
- Reconfirm behavior and acceptance criteria before each PR.
- Keep `main` working after every merge.
- Preserve the existing presentation until its replacement reaches parity.
- Prefer one to three coherent commits per small PR.
- Keep tests beside each behavior rather than postponing verification.
- Do not connect production infrastructure until its dedicated launch work is
  approved.

## 28. Acceptance of this specification

This document freezes the product decisions made during the design grill. It
does not authorize implementation beyond the separately approved feature PR.
If a later PR uncovers a conflict, update this specification explicitly in its
own reviewed change rather than silently changing behavior in code.
