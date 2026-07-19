import { promises as fs } from "node:fs";
import path from "node:path";

const roots = ["README.md", "docs"];

async function files(target: string): Promise<string[]> {
  const stat = await fs.stat(target);
  if (stat.isFile()) return target.endsWith(".md") ? [target] : [];
  const entries = await fs.readdir(target, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => files(path.join(target, entry.name))));
  return nested.flat();
}

async function main(): Promise<void> {
  const markdownFiles = (await Promise.all(roots.map(files))).flat();
  const failures: string[] = [];
  for (const file of markdownFiles) {
    const text = await fs.readFile(file, "utf8");
    if (!text.endsWith("\n")) failures.push(`${file}: missing trailing newline`);
    for (const [index, line] of text.split("\n").entries()) {
      if (/\s$/u.test(line)) failures.push(`${file}:${index + 1}: trailing whitespace`);
    }
  }
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`Checked Markdown formatting for ${markdownFiles.length} files.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
