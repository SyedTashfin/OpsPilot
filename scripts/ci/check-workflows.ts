import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/quality.yml", "utf8");
const requiredJobs = ["workspace", "postgres-pgvector", "e2e"];
const failures: string[] = [];

function indexOfOrFail(block: string, job: string, text: string): number {
  const index = block.indexOf(text);
  if (index === -1) failures.push(`${job}: missing ${text}`);
  return index;
}

for (const job of requiredJobs) {
  const start = workflow.indexOf(`\n  ${job}:`);
  if (start === -1) {
    failures.push(`${job}: missing job`);
    continue;
  }
  const nextJob = workflow.slice(start + 1).search(/\n  [a-z0-9-]+:\n/u);
  const block = workflow.slice(start, nextJob === -1 ? undefined : start + 1 + nextJob);
  const checkout = indexOfOrFail(block, job, "uses: actions/checkout@v4");
  const pnpmSetup = indexOfOrFail(block, job, "uses: pnpm/action-setup@v4");
  const pnpmVersion = indexOfOrFail(block, job, "version: 9.15.5");
  const setupNode = indexOfOrFail(block, job, "uses: actions/setup-node@v4");
  const pnpmCache = indexOfOrFail(block, job, "cache: pnpm");
  const install = indexOfOrFail(block, job, "pnpm install --frozen-lockfile");
  const build = indexOfOrFail(block, job, "pnpm build");
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
  if (!(install >= 0 && install < build))
    failures.push(`${job}: frozen install must precede build`);
  if (block.match(/pnpm build/gu)?.length !== 1)
    failures.push(`${job}: must run pnpm build exactly once`);
  const firstWorkspaceConsumer = [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm test:db",
    "pnpm exec playwright",
    "pnpm test:e2e",
  ]
    .map((command) => block.indexOf(command))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (firstWorkspaceConsumer !== undefined && !(build < firstWorkspaceConsumer)) {
    failures.push(`${job}: pnpm build must precede workspace import consumers`);
  }
  if (block.includes("corepack enable") || block.includes("corepack prepare")) {
    failures.push(`${job}: corepack activation is redundant after pnpm/action-setup`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  "Workflow pnpm setup and build order is valid for workspace, postgres-pgvector, and e2e jobs.",
);
