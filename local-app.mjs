import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] === "start" ? "start" : "dev";
const vinextPath = path.join(projectRoot, "node_modules", ".bin", "vinext");

const storage = spawn(process.execPath, ["local-data-server.mjs"], {
  cwd: projectRoot,
  stdio: ["inherit", "inherit", "inherit", "ipc"],
});

let app;

let isStopping = false;

function stop(exitCode = 0) {
  if (isStopping) return;
  isStopping = true;
  storage.kill("SIGTERM");
  app?.kill("SIGTERM");
  process.exitCode = exitCode;
}

storage.on("message", (message) => {
  if (message?.type !== "ready" || app) return;

  app = spawn(vinextPath, [mode], {
    cwd: projectRoot,
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: ".wrangler/wrangler.log",
    },
    stdio: "inherit",
  });

  app.on("exit", (code) => {
    if (!isStopping) stop(code ?? 0);
  });
});

storage.on("exit", (code) => {
  if (!isStopping) stop(code ?? 1);
});

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
