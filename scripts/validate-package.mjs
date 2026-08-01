import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const failures = [];

function fail(message) {
  failures.push(message);
}

if (!manifest.keywords?.includes("pi-package")) {
  fail('package.json keywords must include "pi-package"');
}

const resourceTypes = ["extensions", "skills", "prompts", "themes"];
for (const type of resourceTypes) {
  const paths = manifest.pi?.[type];
  if (!Array.isArray(paths) || paths.length === 0) {
    fail(`package.json pi.${type} must be a non-empty array`);
    continue;
  }

  for (const resourcePath of paths) {
    try {
      await access(resolve(root, resourcePath));
    } catch {
      fail(`pi.${type} path does not exist: ${resourcePath}`);
    }
  }
}

async function findFiles(directory, predicate) {
  const matches = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) matches.push(...(await findFiles(path, predicate)));
    else if (predicate(entry.name)) matches.push(path);
  }
  return matches;
}

for (const skillPath of await findFiles(join(root, "skills"), (name) => name === "SKILL.md")) {
  const source = await readFile(skillPath, "utf8");
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? "";
  if (!/^name: [a-z0-9]+(?:-[a-z0-9]+)*$/mu.test(frontmatter)) {
    fail(`${skillPath}: missing or invalid skill name`);
  }
  if (!/^description: .+$/mu.test(frontmatter)) {
    fail(`${skillPath}: missing skill description`);
  }
}

const requiredThemeColors = [
  "accent", "border", "borderAccent", "borderMuted", "success", "error", "warning",
  "muted", "dim", "text", "thinkingText", "selectedBg", "userMessageBg",
  "userMessageText", "customMessageBg", "customMessageText", "customMessageLabel",
  "toolPendingBg", "toolSuccessBg", "toolErrorBg", "toolTitle", "toolOutput",
  "mdHeading", "mdLink", "mdLinkUrl", "mdCode", "mdCodeBlock", "mdCodeBlockBorder",
  "mdQuote", "mdQuoteBorder", "mdHr", "mdListBullet", "toolDiffAdded",
  "toolDiffRemoved", "toolDiffContext", "syntaxComment", "syntaxKeyword",
  "syntaxFunction", "syntaxVariable", "syntaxString", "syntaxNumber", "syntaxType",
  "syntaxOperator", "syntaxPunctuation", "thinkingOff", "thinkingMinimal", "thinkingLow",
  "thinkingMedium", "thinkingHigh", "thinkingXhigh", "bashMode",
];

for (const themePath of await findFiles(join(root, "themes"), (name) => name.endsWith(".json"))) {
  let theme;
  try {
    theme = JSON.parse(await readFile(themePath, "utf8"));
  } catch (error) {
    fail(`${themePath}: invalid JSON (${error.message})`);
    continue;
  }

  if (!theme.name || theme.name.includes("/")) fail(`${themePath}: invalid theme name`);
  for (const color of requiredThemeColors) {
    if (!(color in (theme.colors ?? {}))) fail(`${themePath}: missing color ${color}`);
  }
}

if (failures.length > 0) {
  console.error("Package validation failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Pi package manifest and resources are valid.");
}
