# QRousel

QRousel is a React application for presenting QR-code slides. The current local
prototype rotates slides every fifteen seconds, supports keyboard navigation,
and stores slide metadata and uploaded images on the local machine.

## Stack

- React 19 with TypeScript
- Vite for local development and production builds
- Firebase client SDK boundary for the upcoming multi-tenant application
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

## Checks

```bash
npm run lint
npm run test
```

`npm run test` creates the production Vite build, runs the unit tests, and
checks the generated application document. GitHub Actions runs the same lint and
test commands for pull requests to `main`, pushes to `main`, and manual runs.

To serve an existing production build locally, run `npm run start`.
