import { execFileSync, spawn } from "node:child_process";

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const environment = { ...process.env };

// Firebase emulators require Java 21+. macOS can keep an older Java version
// as the shell default even when a supported JDK is already installed.
if (process.platform === "darwin") {
  try {
    environment.JAVA_HOME = execFileSync("/usr/libexec/java_home", ["-v", "21+"], {
      encoding: "utf8",
    }).trim();
    environment.PATH = `${environment.JAVA_HOME}/bin:${environment.PATH}`;
  } catch {
    // Firebase will print its actionable Java error if no supported JDK exists.
  }
}

const emulator = spawn(command, ["firebase-tools", "emulators:exec", "--project", "qrousel-e2e", "--only", "auth,firestore", "npx playwright test"], {
  cwd: process.cwd(),
  env: environment,
  stdio: "inherit",
});

emulator.on("exit", (code) => process.exitCode = code ?? 1);
