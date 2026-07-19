import { execFileSync } from "node:child_process";

const ignoredFiles = new Set(["pnpm-lock.yaml"]);

const forbidden = [
  { name: "private key", pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/gu },
  { name: "aws access key", pattern: /AKIA[0-9A-Z]{16}/gu },
  { name: "google api key", pattern: /AIza[0-9A-Za-z_-]{35}/gu },
  { name: "slack token", pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/gu },
  { name: "openai api key", pattern: /sk-[A-Za-z0-9]{32,}/gu },
  {
    name: "managed postgres url",
    pattern:
      /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@(?:[^\s/]+\.)?(?:rds\.amazonaws\.com|database\.azure\.com|supabase\.(?:co|com)|neon\.tech)/giu,
  },
];

const allowedExactMatches = new Set([
  "sk-lf-opspilot-dev",
  "sk-lf-...-dev",
  "test-credential",
  "test-key",
  "secret-value",
  "password-value",
  "token-value",
  "opspilot:opspilot",
  "postgres://u:p@example.rds.amazonaws.com",
  "postgres://secret-user:secret-pass@example.rds.amazonaws.com",
]);

export type SecretFinding = { readonly file: string; readonly kind: string; readonly line: number };

function lineNumberAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

export function scanText(file: string, text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const rule of forbidden) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      if (allowedExactMatches.has(match[0])) continue;
      findings.push({ file, kind: rule.name, line: lineNumberAt(text, match.index ?? 0) });
    }
  }
  return findings;
}

export function scanTrackedFiles(): SecretFinding[] {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((file) => !ignoredFiles.has(file));
  return tracked.flatMap((file) => {
    const text = execFileSync("git", ["show", `HEAD:${file}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return scanText(file, text);
  });
}

if (process.argv[1]?.endsWith("secret-scan.ts")) {
  const findings = scanTrackedFiles();
  if (findings.length) {
    console.error(
      `Potential committed secret material in:\n${findings
        .map((finding) => `${finding.file}:${finding.line} ${finding.kind}`)
        .join("\n")}`,
    );
    process.exit(1);
  }
  const trackedCount = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((file) => !ignoredFiles.has(file)).length;
  console.log(`Secret pattern scan passed for ${trackedCount} tracked files.`);
}
