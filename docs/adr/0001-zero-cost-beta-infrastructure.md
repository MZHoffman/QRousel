---
status: accepted
---

# Keep the beta infrastructure incapable of surprise charges

QRousel's first public beta will use Netlify Free for the frontend, privileged Functions, and Blobs; Firebase Spark for Google Authentication and Cloud Firestore; and Resend Free for invitation and sensitive-account email. No Firebase billing account may be attached, and the beta must not use Firebase Cloud Storage, Cloud Functions, Authentication blocking functions, or Identity Platform. We accept quota-driven degradation or suspension because a temporarily unavailable free beta is preferable to an unexpected bill.

## Consequences

- Trusted mutations, invitation handling, publishing, auditing, quota cleanup, and permanent deletion run through Netlify Functions.
- Original and processed media live in Netlify Blobs rather than Firebase Storage.
- QRousel admits at most 200 active application accounts, but cannot prevent every external Firebase Authentication record without paid blocking functions.
- Trackable QR redirects and public presentations can become unavailable if Netlify suspends the site after its free allowance is exhausted; Direct QR codes remain independent after generation.
- Invitation email is capped in the application at 10 sends per day and 100 per month, with copy-link invitations as the no-email fallback.
- Any future feature that requires enabling billing or a paid service must be proposed as a new architectural decision before implementation.
