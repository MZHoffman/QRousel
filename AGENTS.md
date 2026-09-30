# Verification and release

After every completed change, run `npm run verify` on the final code before reporting completion or merging. This is the full local regression gate, including Firebase emulator browser journeys.

For each changed behavior, exercise its success and relevant failure paths. Extend E2E coverage when the changed user journey is not covered. For visible UI changes, inspect the rendered page at desktop and narrow widths, including focus, loading, and error states. Keep test accounts and destructive cleanup inside the local emulators.

If a check fails, reproduce the failure, fix the cause, and rerun the complete verification gate. Preserve assertions that protect intended behavior. If an external prerequisite prevents verification, report the exact blocker and which checks remain unverified; do not claim the app passes.

Before merging each implementation or production release PR, wait for its required CI checks to pass on the latest commit. After deployment, confirm the published commit and run safe production smoke checks. Distinguish local emulator coverage from authenticated production testing and real Google/email provider checks; a 401 probe alone verifies only the unauthenticated route.

In the handoff, report what changed, the checks actually passed, any uncovered behavior, deployment status, and the next useful step. A passing suite is evidence for covered flows, not a guarantee that every feature is correct.
