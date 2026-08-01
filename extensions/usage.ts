import type {
  ExtensionAPI,
  ExtensionCommandContext,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";

interface UsageLike {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

export interface SessionUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  assistantTurns: number;
  apiDurationMs: number;
  linesAdded: number;
  linesRemoved: number;
}

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

function countChangedLines(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) added += 1;
    else if (line.startsWith("-")) removed += 1;
  }

  return { added, removed };
}

function countContentLines(content: string): number {
  if (!content) return 0;
  const lines = content.split(/\r\n|\r|\n/).length;
  return /(?:\r\n|\r|\n)$/.test(content) ? lines - 1 : lines;
}

export function calculateSessionUsage(entries: readonly SessionEntry[]): SessionUsage {
  const summary: SessionUsage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    assistantTurns: 0,
    apiDurationMs: 0,
    linesAdded: 0,
    linesRemoved: 0,
  };
  const toolCalls = new Map<string, ToolCall>();

  const addUsage = (usage: UsageLike) => {
    summary.input += usage.input;
    summary.output += usage.output;
    summary.cacheRead += usage.cacheRead;
    summary.cacheWrite += usage.cacheWrite;
    summary.cost.input += usage.cost.input;
    summary.cost.output += usage.cost.output;
    summary.cost.cacheRead += usage.cost.cacheRead;
    summary.cost.cacheWrite += usage.cost.cacheWrite;
    summary.cost.total += usage.cost.total;
  };

  for (const entry of entries) {
    if ((entry.type === "branch_summary" || entry.type === "compaction") && entry.usage) {
      addUsage(entry.usage);
      continue;
    }

    if (entry.type !== "message") continue;

    if (entry.message.role === "assistant") {
      summary.assistantTurns += 1;
      addUsage(entry.message.usage);

      const finishedAt = Date.parse(entry.timestamp);
      if (Number.isFinite(finishedAt) && finishedAt >= entry.message.timestamp) {
        summary.apiDurationMs += finishedAt - entry.message.timestamp;
      }

      for (const content of entry.message.content) {
        if (content.type === "toolCall") {
          toolCalls.set(content.id, { name: content.name, arguments: content.arguments });
        }
      }
    } else if (entry.message.role === "toolResult") {
      if (entry.message.usage) addUsage(entry.message.usage);
      if (entry.message.isError) continue;

      const call = toolCalls.get(entry.message.toolCallId);
      const details = entry.message.details as { patch?: unknown; diff?: unknown } | undefined;
      const diff = typeof details?.patch === "string"
        ? details.patch
        : typeof details?.diff === "string"
          ? details.diff
          : undefined;

      if (entry.message.toolName === "edit" && diff) {
        const changes = countChangedLines(diff);
        summary.linesAdded += changes.added;
        summary.linesRemoved += changes.removed;
      } else if (entry.message.toolName === "write" && call?.name === "write") {
        const content = call.arguments.content;
        if (typeof content === "string") summary.linesAdded += countContentLines(content);
      }
    }
  }

  return summary;
}

export function formatTokens(tokens: number): string {
  return Math.round(tokens).toLocaleString("en-US");
}

export function formatCost(cost: number): string {
  if (cost === 0) return "$0.0000";
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatDuration(durationMs: number): string {
  let seconds = Math.floor(Math.max(0, durationMs) / 1_000);
  const days = Math.floor(seconds / 86_400);
  seconds %= 86_400;
  const hours = Math.floor(seconds / 3_600);
  seconds %= 3_600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  return [
    days ? `${days}d` : "",
    hours ? `${hours}h` : "",
    minutes ? `${minutes}m` : "",
    `${seconds}s`,
  ].filter(Boolean).join(" ");
}

export function formatUsageReport(usage: SessionUsage, wallDurationMs = 0): string {
  const line = (label: string, value: string) => `  ${`${label}:`.padEnd(23)}${value}`;
  const changedLines = (count: number, action: string) =>
    `${formatTokens(count)} line${count === 1 ? "" : "s"} ${action}`;

  return [
    "Session",
    "",
    line("Total cost", `$${usage.cost.total.toFixed(4)}`),
    line("Total duration (API)", formatDuration(usage.apiDurationMs)),
    line("Total duration (wall)", formatDuration(wallDurationMs)),
    line(
      "Total code changes",
      `${changedLines(usage.linesAdded, "added")}, ${changedLines(usage.linesRemoved, "removed")}`,
    ),
    line(
      "Usage",
      `${formatTokens(usage.input)} input, ${formatTokens(usage.output)} output, ${formatTokens(usage.cacheRead)} cache read, ${formatTokens(usage.cacheWrite)} cache write`,
    ),
  ].join("\n");
}

export default function usageExtension(pi: ExtensionAPI) {
  let sessionStartedAt = Date.now();

  const showUsage = (ctx: ExtensionCommandContext) => {
    const usage = calculateSessionUsage(ctx.sessionManager.getEntries());
    ctx.ui.notify(formatUsageReport(usage, Date.now() - sessionStartedAt), "info");
  };

  pi.on("session_start", () => {
    sessionStartedAt = Date.now();
  });

  pi.registerCommand("usage", {
    description: "Show current-session cost, duration, code changes, and token usage",
    handler: async (_args, ctx) => showUsage(ctx),
  });

  pi.registerCommand("cost", {
    description: "Alias for /usage",
    handler: async (_args, ctx) => showUsage(ctx),
  });
}
