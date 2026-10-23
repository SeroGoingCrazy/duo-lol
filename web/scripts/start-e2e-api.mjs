import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// Use uv normally; Windows workspaces with an existing synced venv can run it directly.
// Arguments stay separate from the shell, including a caller-provided Postgres test URL.
const localPython = path.resolve(".venv/Scripts/python.exe");
const python = process.platform === "win32" && existsSync(localPython) ? localPython : "uv";
const prefix = python === "uv" ? ["run", "python"] : [];
const db = process.env.DUO_DB;
if (!db) throw new Error("DUO_DB must name the isolated E2E database");

async function run(args) {
  const child = spawn(python, [...prefix, ...args], { stdio: "inherit", env: process.env });
  const stop = () => child.kill();
  process.once("SIGTERM", stop);
  try {
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Test API process exited: ${code}`)));
    });
  } finally { process.removeListener("SIGTERM", stop); }
}

await run(["data/fake_riot.py", db]);
await run(["data/score_scale.py", "--db", db]);
await run(["-m", "uvicorn", "api:app", "--app-dir", "data", "--port", "8100"]);
