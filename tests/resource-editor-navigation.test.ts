import assert from "node:assert/strict";
import test from "node:test";
import { resolveWorkspaceResourceEditor, workspaceResourceEditorPath } from "../lib/workspaces/resource-editor-navigation.ts";
test("builds resource editor paths and resolves them safely", () => {
  assert.equal(workspaceResourceEditorPath("work space", "slides", "new"), "/app/workspaces/work%20space/slides/new");
  assert.deepEqual(resolveWorkspaceResourceEditor("/app/workspaces/work%20space/qr-codes/qr%201", "work space", "qr-codes"), { mode: "edit", resourceId: "qr 1" });
});
