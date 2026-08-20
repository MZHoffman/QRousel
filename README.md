# QRousel

QRousel is a React application for presenting QR-code slides. The current local
prototype rotates slides every fifteen seconds, supports keyboard navigation,
and stores slide metadata and uploaded images on the local machine.

## Stack

- React 19 with TypeScript
- Vite for local development and production builds
- Firebase Authentication and Cloud Firestore for accounts and application data
- Netlify Functions for trusted account admission and future mutations
- Node.js local data server for the existing prototype storage

The production architecture and product constraints are recorded in
[`docs/product-specification.md`](docs/product-specification.md).

## Prerequisites

- Node.js `>=22.13.0`

## Local development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`. The command starts both Vite and the local data
server. Slide records are saved in `slides.json`, and uploaded images are saved
in `pictures/`.

Copy `.env.example` to `.env.local` only when Firebase-backed development is
needed. Firebase web configuration is public identification, not authorization;
never put service-account credentials or server secrets in `VITE_*` variables.

Google sign-in is available at `http://127.0.0.1:3000/sign-in`. A deployed
Netlify site rewrites `/api/accounts/admit` to the trusted admission function.
For deployed authentication, configure the four public `VITE_FIREBASE_*`
variables and the server-only `FIREBASE_SERVICE_ACCOUNT_JSON` Netlify secret.
Enable only Google Authentication in Firebase, add the deployed domain to the
authorized domains list, and deploy `firestore.rules` before admitting users.

The admission function creates application profiles in an authoritative
Firestore transaction. It allows at most 200 active or suspended accounts,
while existing accounts can continue signing in after capacity is reached.
Threshold events at 150, 180, 195, and 200 are written as pending operator
notifications for a later notification-delivery feature.

## Checks

```bash
npm run lint
npm run test
```

`npm run test` checks TypeScript (including Netlify Functions), creates the
production Vite build, runs the unit tests, and checks the generated application
document. GitHub Actions runs the same lint and test commands for pull requests
to `main`, pushes to `main`, and manual runs.

To serve an existing production build locally, run `npm run start`.
