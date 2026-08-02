import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateHead } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { discoverAgents, loadAgentModels, resolveAgentModel, type AgentDefinition } from "./agents.js";

const MAX_TASKS = 4;

const TaskSchema = Type.Object({
  agent: Type.String({ description: "Agent name: scout, planner, worker, debugger, or reviewer" }),
  task: Type.String({ description: "Bounded task and expected output for the subagent" }),
});

interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
}

interface AgentRun {
  agent: string;
  source: string;
  model: string;
  task: string;
  output: string;
  error?: string;
  usage: Usage;
}

function emptyUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function addUsage(total: Usage, value: Partial<Usage> | undefined): void {
  if (!value) return;
  total.input += value.input ?? 0;
  total.output += value.output ?? 0;
  total.cacheRead += value.cacheRead ?? 0;
  total.cacheWrite += value.cacheWrite ?? 0;
  total.totalTokens += value.totalTokens ?? 0;
  for (const key of ["input", "output", "cacheRead", "cacheWrite", "total"] as const) {
    total.cost[key] += value.cost?.[key] ?? 0;
  }
}

export function parseJsonRun(stdout: string): { output: string; usage: Usage; error?: string } {
  let output = "";
  let error: string | undefined;
  const usage = emptyUsage();

  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    let event: { type?: string; message?: Record<string, unknown> };
    try {
      event = JSON.parse(line) as typeof event;
    } catch {
      continue;
    }
    if (event.type !== "message_end" || event.message?.role !== "assistant") continue;

    addUsage(usage, event.message.usage as Partial<Usage> | undefined);
    if (event.message.stopReason === "error" || event.message.stopReason === "aborted") {
      error = typeof event.message.errorMessage === "string"
        ? event.message.errorMessage
        : `Subagent stopped: ${event.message.stopReason}`;
    }
    const content = event.message.content;
    if (!Array.isArray(content)) continue;
    const text = content
      .filter((part): part is { type: "text"; text: string } =>
        typeof part === "object" && part !== null && part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n");
    if (text) output = text;
  }

  return { output, usage, error };
}

export function canRunInParallel(agents: readonly AgentDefinition[]): boolean {
  return agents.every((agent) => agent.readOnly);
}

function formatModel(provider: string, id: string, thinkingLevel: string | undefined): string {
  const thinking = thinkingLevel && thinkingLevel !== "off" ? `:${thinkingLevel}` : "";
  return `${provider}/${id}${thinking}`;
}

function visibleOutput(run: AgentRun): string {
  if (run.error) return run.error;
  const truncated = truncateHead(run.output || "(no output)");
  return truncated.truncated
    ? `${truncated.content}\n\n[Subagent output truncated from ${truncated.totalLines} lines.]`
    : truncated.content;
}

export default function orchestrator(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Delegate one to four bounded tasks to bundled or user-configured agents. Parallel execution is allowed only for agents marked read-only.",
    promptSnippet: "Delegate orchestrated work to isolated specialist agents",
    promptGuidelines: [
      "Use subagent only in orchestrator mode; run workers sequentially and review completed changes before reporting success.",
    ],
    parameters: Type.Object({
      tasks: Type.Array(TaskSchema, { minItems: 1, maxItems: MAX_TASKS }),
      parallel: Type.Optional(Type.Boolean({ description: "Run independent read-only tasks concurrently" })),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const agents = discoverAgents(ctx.cwd, ctx.isProjectTrusted());
      const selected = params.tasks.map(({ agent }) => agents.find((candidate) => candidate.name === agent));
      const missing = params.tasks.filter((_task, index) => !selected[index]).map((task) => task.agent);
      if (missing.length) {
        throw new Error(`Unknown subagent(s): ${missing.join(", ")}. Available: ${agents.map((a) => a.name).join(", ")}`);
      }

      const definitions = selected as AgentDefinition[];
      if (params.parallel && !canRunInParallel(definitions)) {
        throw new Error("Parallel delegation is limited to agents marked read-only. Run workers and other writers sequentially.");
      }

      const projectAgents = definitions.filter((agent) => agent.source === "project");
      if (projectAgents.length && ctx.hasUI) {
        const approved = await ctx.ui.confirm(
          "Run project-local subagents?",
          `${[...new Set(projectAgents.map((agent) => agent.name))].join(", ")} are controlled by this repository.`,
          { signal },
        );
        if (!approved) throw new Error("Project-local subagents were not approved.");
      }

      if (!ctx.model) throw new Error("No parent model is selected.");
      const parentModel = formatModel(ctx.model.provider, ctx.model.id, ctx.thinkingLevel);
      const configuredModels = loadAgentModels();

      const run = async (definition: AgentDefinition, task: string): Promise<AgentRun> => {
        const model = resolveAgentModel(definition, parentModel, configuredModels);
        const args = ["--mode", "json", "-p", "--no-session", "--model", model];
        if (definition.tools?.length) args.push("--tools", definition.tools.join(","));
        args.push("--append-system-prompt", definition.systemPrompt, `Task: ${task}`);

        onUpdate?.({
          content: [{ type: "text", text: `Running ${definition.name} (${model})…` }],
          details: { mode: params.parallel ? "parallel" : "sequential", running: definition.name },
        });

        const result = await pi.exec("pi", args, { cwd: ctx.cwd, signal });
        const parsed = parseJsonRun(result.stdout);
        return {
          agent: definition.name,
          source: definition.source,
          model,
          task,
          output: parsed.output,
          error: parsed.error ?? (result.code === 0
            ? undefined
            : result.stderr.trim() || `Subagent exited with code ${result.code}`),
          usage: parsed.usage,
        };
      };

      const runs: AgentRun[] = [];
      if (params.parallel) {
        runs.push(...await Promise.all(params.tasks.map((task, index) => run(definitions[index], task.task))));
      } else {
        for (let index = 0; index < params.tasks.length; index += 1) {
          runs.push(await run(definitions[index], params.tasks[index].task));
          if (runs.at(-1)?.error) break;
        }
      }

      const usage = emptyUsage();
      for (const item of runs) addUsage(usage, item.usage);
      const text = runs.map((item) =>
        `## ${item.agent} (${item.model})\n\n${visibleOutput(item)}`).join("\n\n---\n\n");

      return {
        content: [{ type: "text", text }],
        details: { mode: params.parallel ? "parallel" : "sequential", runs },
        usage,
      };
    },
  });
}
