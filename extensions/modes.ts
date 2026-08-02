import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export const WORKFLOW_MODES = ["code", "plan", "ask", "debug", "orchestrator"] as const;
export type WorkflowMode = (typeof WORKFLOW_MODES)[number];

const READ_TOOLS = ["read", "Glob", "Grep", "WebSearch", "AskUserQuestion"];
const MODE_INSTRUCTIONS: Record<WorkflowMode, string> = {
  code: `You are in CODE MODE. Implement the requested change directly.
- Keep scope focused and read relevant code before editing.
- Make the smallest correct change.
- Run the relevant tests or checks before finishing.`,
  plan: `You are in PLAN MODE. Investigate and produce a plan without changing the repository.
- Ask focused clarifying questions when requirements materially affect the design.
- Trace the relevant code and tests before proposing changes.
- Return numbered steps, files affected, tests, risks, and unresolved decisions.
- Do not edit files or run mutating commands.`,
  ask: `You are in ASK MODE. Answer repository questions using evidence from the codebase.
- Read and search when the answer depends on repository state.
- Answer directly and distinguish evidence from inference.
- Do not modify files or turn the answer into an implementation unless explicitly asked to switch modes.`,
  debug: `You are in DEBUG MODE. Diagnose bugs systematically, then fix them.
- Reproduce the failure before editing whenever practical.
- Form and test hypotheses, then fix the root cause rather than the symptom.
- Add or update the smallest useful regression check and verify the fix.`,
  orchestrator: `You are in ORCHESTRATOR MODE. Coordinate specialized subagents; do not edit files directly.
- Delegate discovery to scout, design to planner, diagnosis to debugger, changes to worker, and validation to reviewer.
- Parallelize only independent read-only tasks. Run file-writing workers sequentially.
- For a normal implementation, finish with reviewer; if it finds issues, delegate fixes to worker and review again.
- Give each subagent a bounded task with expected output and relevant context.
- Synthesize results, resolve conflicts, and report the final outcome to the user.`,
};

const SAFE_BASH_PATTERNS = [
  /^pwd(?:\s|$)/,
  /^ls(?:\s|$)/,
  /^tree(?:\s|$)/,
  /^find(?:\s|$)/,
  /^rg(?:\s|$)/,
  /^grep(?:\s|$)/,
  /^cat(?:\s|$)/,
  /^head(?:\s|$)/,
  /^tail(?:\s|$)/,
  /^wc(?:\s|$)/,
  /^stat(?:\s|$)/,
  /^file(?:\s|$)/,
  /^git\s+(?:status|diff|log|show|branch)(?:\s|$)/,
  /^(?:npm|pnpm|yarn)\s+(?:list|ls|view|info|outdated)(?:\s|$)/,
];

export function isReadOnlyCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed || /[;&|`<>]|\$\(/u.test(trimmed) || trimmed.includes("\n")) return false;
  return SAFE_BASH_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function toolsForMode(
  mode: WorkflowMode,
  availableTools: readonly string[],
  fullTools: readonly string[],
): string[] {
  const available = new Set(availableTools);
  const choose = (names: readonly string[]) => [...new Set(names)].filter((name) => available.has(name));

  if (mode === "code" || mode === "debug") {
    return choose(fullTools.filter((name) => name !== "subagent"));
  }
  if (mode === "ask") return choose(READ_TOOLS);
  if (mode === "plan") return choose([...READ_TOOLS, "bash"]);
  return choose([...READ_TOOLS, "bash", "subagent"]);
}

function restoredMode(ctx: ExtensionContext): WorkflowMode {
  const entry = ctx.sessionManager.getBranch()
    .filter((item) => item.type === "custom" && item.customType === "workflow-mode")
    .pop() as { data?: { mode?: string } } | undefined;
  return WORKFLOW_MODES.includes(entry?.data?.mode as WorkflowMode)
    ? entry?.data?.mode as WorkflowMode
    : "code";
}

export default function workflowModes(pi: ExtensionAPI): void {
  let mode: WorkflowMode = "code";
  let fullTools: string[] | undefined;

  const applyTools = () => {
    const available = pi.getAllTools().map((tool) => tool.name);
    if (!fullTools) fullTools = pi.getActiveTools();
    pi.setActiveTools(toolsForMode(mode, available, fullTools));
  };

  const announce = (ctx: ExtensionContext, persist: boolean) => {
    pi.events.emit("workflow-mode:changed", mode);
    if (persist) pi.appendEntry("workflow-mode", { mode });
    ctx.ui.notify(`${mode.toUpperCase()} mode active`, "info");
  };

  const activate = (nextMode: WorkflowMode, ctx: ExtensionContext) => {
    mode = nextMode;
    applyTools();
    announce(ctx, true);
  };

  for (const name of WORKFLOW_MODES) {
    pi.registerCommand(name, {
      description: {
        code: "Implement focused changes with full tool access",
        plan: "Investigate and plan without modifying files",
        ask: "Answer repository questions without modifying files",
        debug: "Reproduce, diagnose, fix, and verify bugs",
        orchestrator: "Delegate work to specialized subagents",
      }[name],
      handler: async (_args, ctx) => activate(name, ctx),
    });
  }

  pi.on("session_start", (_event, ctx) => {
    fullTools = pi.getActiveTools();
    mode = restoredMode(ctx);
    applyTools();
    pi.events.emit("workflow-mode:changed", mode);
  });

  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${MODE_INSTRUCTIONS[mode]}`,
  }));

  pi.on("tool_call", (event) => {
    if (mode === "code" || mode === "debug") return;
    if (event.toolName === "edit" || event.toolName === "write") {
      return { block: true, reason: `${mode} mode does not allow direct file changes. Use /code or /debug first.` };
    }
    if (event.toolName === "bash" && !isReadOnlyCommand(String(event.input.command ?? ""))) {
      return { block: true, reason: `${mode} mode only allows simple read-only shell commands.` };
    }
  });
}
