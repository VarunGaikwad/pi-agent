import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_DIR_NAME, getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";

export type AgentSource = "bundled" | "user" | "project";

export interface AgentDefinition {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  readOnly: boolean;
  systemPrompt: string;
  source: AgentSource;
  filePath: string;
}

export function parseAgentDefinition(
  content: string,
  source: AgentSource,
  filePath: string,
): AgentDefinition | undefined {
  const { frontmatter, body } = parseFrontmatter<Record<string, string | boolean>>(content);
  const name = typeof frontmatter.name === "string" ? frontmatter.name : undefined;
  const description = typeof frontmatter.description === "string" ? frontmatter.description : undefined;
  if (!name || !description || !body.trim()) return undefined;

  const toolsValue = typeof frontmatter.tools === "string" ? frontmatter.tools : undefined;
  const tools = toolsValue?.split(",").map((tool: string) => tool.trim()).filter(Boolean);
  const model = typeof frontmatter.model === "string" ? frontmatter.model.trim() : undefined;
  return {
    name,
    description,
    tools: tools?.length ? tools : undefined,
    model: model || undefined,
    readOnly: frontmatter["read-only"] === true || frontmatter["read-only"] === "true",
    systemPrompt: body.trim(),
    source,
    filePath,
  };
}

function loadDirectory(path: string, source: AgentSource): AgentDefinition[] {
  if (!existsSync(path)) return [];
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => {
        const filePath = join(path, entry.name);
        return parseAgentDefinition(readFileSync(filePath, "utf8"), source, filePath);
      })
      .filter((agent): agent is AgentDefinition => agent !== undefined);
  } catch {
    return [];
  }
}

function nearestProjectAgents(cwd: string): string | undefined {
  let current = cwd;
  while (true) {
    const candidate = join(current, CONFIG_DIR_NAME, "agents");
    try {
      if (statSync(candidate).isDirectory()) return candidate;
    } catch {
      // Continue towards the filesystem root.
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

const bundledAgents = fileURLToPath(new URL("../../agents/", import.meta.url));

export function discoverAgents(cwd: string, includeProject: boolean): AgentDefinition[] {
  const byName = new Map<string, AgentDefinition>();
  const directories: Array<[string, AgentSource]> = [
    [bundledAgents, "bundled"],
    [join(getAgentDir(), "agents"), "user"],
  ];
  const project = includeProject ? nearestProjectAgents(cwd) : undefined;
  if (project) directories.push([project, "project"]);

  for (const [path, source] of directories) {
    for (const agent of loadDirectory(path, source)) byName.set(agent.name, agent);
  }
  return [...byName.values()];
}

export type AgentModels = Record<string, string>;

function stripJsonComments(content: string): string {
  return content
    .replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*/g, (match) => match[0] === '"' ? match : "")
    .replace(/"(?:\\.|[^"\\])*"|,(\s*[}\]])/g, (match, tail: string | undefined) =>
      tail ?? (match[0] === '"' ? match : ""));
}

export function parseAgentModels(content: string): AgentModels {
  let config: unknown;
  try {
    config = JSON.parse(stripJsonComments(content));
  } catch (error) {
    throw new Error(`Failed to parse agents in models.json: ${error instanceof Error ? error.message : error}`);
  }

  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("Invalid models.json: root must be an object.");
  }
  const agents = (config as { agents?: unknown }).agents;
  if (agents === undefined) return {};
  if (typeof agents !== "object" || agents === null || Array.isArray(agents)) {
    throw new Error("Invalid models.json: agents must be an object mapping agent names to models.");
  }

  const models: AgentModels = {};
  for (const [name, model] of Object.entries(agents)) {
    if (!name.trim() || typeof model !== "string" || !model.trim()) {
      throw new Error(`Invalid models.json agent assignment: ${name || "(empty name)"}.`);
    }
    models[name] = model.trim();
  }
  return models;
}

export function loadAgentModels(path = join(getAgentDir(), "models.json")): AgentModels {
  if (!existsSync(path)) return {};
  try {
    return parseAgentModels(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : error}\n\nFile: ${path}`);
  }
}

export function resolveAgentModel(
  agent: AgentDefinition,
  parentModel: string,
  configuredModels: AgentModels = {},
): string {
  return configuredModels[agent.name] ?? agent.model ?? parentModel;
}
