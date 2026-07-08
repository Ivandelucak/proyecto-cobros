/* global process, require */

const { spawn } = require("node:child_process");
const electronPath = require("electron");

process.env.ELECTRON_APP_URL = process.env.ELECTRON_APP_URL || "http://localhost:3000";

const child = spawn(electronPath, ["electron/main.js"], {
  env: process.env,
  stdio: "inherit",
  windowsHide: false
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
