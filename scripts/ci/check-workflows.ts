import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/quality.yml", "utf8");
const requiredJobs = ["workspace", "postgres-pgvector", "e2e"];
const failures: string[] = [];

for (const job of requiredJobs) {
  const start = workflow.indexOf(`\n  ${job}:`);
  if (start === -1) {
    failures.push(`${job}: missing job`);
    continue;
  }
  const nextJob = workflow.slice(start + 1).search(/\n  [a-z0-9-]+:\n/u);
  const block = workflow.slice(start, nextJob === -1 ? undefined : start + 1 + nextJob);
  const checkout = block.indexOf("uses: actions/checkout@v4");
  const pnpmSetup = block.indexOf("uses: pnpm/action-setup@v4");
  const pnpmVersion = block.indexOf("version: 9.15.5");
  const setupNode = block.indexOf("uses: actions/setup-node@v4");
  const pnpmCache = block.indexOf("cache: pnpm");
  const install = block.indexOf("pnpm install --frozen-lockfile");
  if (!(checkout >= 0 && checkout < pnpmSetup))
    failures.push(`${job}: checkout must precede pnpm setup`);
  if (!(pnpmSetup >= 0 && pnpmSetup < setupNode)) {
    failures.push(`${job}: pnpm/action-setup@v4 must precede actions/setup-node@v4`);
  }
  if (!(pnpmVersion > pnpmSetup && pnpmVersion < setupNode)) {
    failures.push(`${job}: pinned pnpm 9.15.5 must be configured before setup-node`);
  }
  if (!(setupNode >= 0 && pnpmCache > setupNode && setupNode < install)) {
    failures.push(`${job}: setup-node pnpm cache must precede frozen install`);
  }
  if (block.includes("corepack enable") || block.includes("corepack prepare")) {
    failures.push(`${job}: corepack activation is redundant after pnpm/action-setup`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Workflow pnpm setup order is valid for workspace, postgres-pgvector, and e2e jobs.");
