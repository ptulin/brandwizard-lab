#!/usr/bin/env node
/**
 * Create Vercel project via API (if needed), link, then deploy.
 * Uses auth from ~/Library/Application Support/com.vercel.cli/auth.json
 */
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const authPath = join(
  process.env.HOME || process.env.USERPROFILE,
  "Library",
  "Application Support",
  "com.vercel.cli",
  "auth.json"
);

const teamId = "team_KEqxwNhmzK99r48pwzaUi3fn";
const projectName = "brandwizard-lab";

function readToken() {
  const auth = JSON.parse(readFileSync(authPath, "utf8"));
  return auth.token;
}

async function createProject(token) {
  const res = await fetch(
    `https://api.vercel.com/v11/projects?teamId=${teamId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName,
        framework: "nextjs",
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    if (res.status === 409 || err.includes("already exists")) {
      const getRes = await fetch(
        `https://api.vercel.com/v11/projects/${projectName}?teamId=${teamId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (getRes.ok) return getRes.json();
    }
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json();
}

async function main() {
  const token = readToken();
  const project = await createProject(token);
  const projectId = project.id;
  const orgId = project.accountId || teamId;

  const vercelDir = join(root, ".vercel");
  mkdirSync(vercelDir, { recursive: true });
  writeFileSync(
    join(vercelDir, "project.json"),
    JSON.stringify({ projectId, orgId }, null, 2)
  );

  console.log("Linked project:", projectName, "id:", projectId);
  process.env.VERCEL_ORG_ID = orgId;
  process.env.VERCEL_PROJECT_ID = projectId;
  process.env.VERCEL_TOKEN = token;

  const { spawn } = await import("child_process");
  const vc = spawn("npx", ["vercel", "--yes", "--prod"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, VERCEL_ORG_ID: orgId, VERCEL_PROJECT_ID: projectId, VERCEL_TOKEN: token },
  });
  vc.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
