import assert from "node:assert/strict";
import test from "node:test";
import { decideIconCreation, ICON_LIMIT } from "../lib/icons/creation.ts";
test("prepares a trimmed reusable icon", () => assert.deepEqual(decideIconCreation({ iconCount: 3, requestedName: "  Green mark  ", imageDataUrl: "data:image/png;base64,AA==" }), { kind: "create", name: "Green mark", imageDataUrl: "data:image/png;base64,AA==", nextIconCount: 4 }));
test("stops icon creation at the workspace cap", () => assert.deepEqual(decideIconCreation({ iconCount: ICON_LIMIT, requestedName: "One too many", imageDataUrl: "data:image/png;base64,AA==" }), { kind: "limit", limit: 100 }));
