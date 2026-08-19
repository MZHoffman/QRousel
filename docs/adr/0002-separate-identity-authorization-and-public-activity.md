---
status: accepted
---

# Separate identity, authorization, and public activity

Firebase Authentication with Google supplies identity for registered users, but it grants no QRousel access by itself: an admitted application profile and an explicit workspace membership determine authorization. Public deck players and Trackable QR redirects remain unauthenticated surfaces and must expose only their published or redirect-specific data. This separation keeps workspace access revocable and auditable without turning public viewers or QR scanners into tracked users.

## Consequences

- Google is the only sign-in provider in the beta; password and email-link sign-in are deferred.
- A Firebase Authentication record without an admitted QRousel profile cannot access private application data.
- Every private operation verifies the admitted profile, workspace membership, role, and same-workspace ownership of referenced resources.
- Public players cannot read drafts, libraries, membership, activity, or management data.
- A Trackable QR recorded-open event contains only a random event ID, QR ID, server UTC timestamp, and destination revision.
- QRousel stores no scanner identity, account association, IP address, cookie, persistent visitor ID, fingerprint, device detail, precise location, or referrer URL.
- Redirect logging is best-effort and must never delay or prevent the destination redirect.
- QRousel publishes a general privacy page explaining recorded opens, but shows no scanner popup, consent prompt, or cookie banner because the redirect sets no tracking identifier.
- Changing these boundaries requires a new architectural decision and a legal/privacy review before collecting additional public-visitor data.
