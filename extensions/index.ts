import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import askUserQuestion from "./ask-user-question.js";
import glob from "./glob.js";
import grep from "./grep.js";
import workflowModes from "./modes.js";
import orchestrator from "./orchestrator/index.js";
import codingAgentTui from "./tui.js";
import usage from "./usage.js";
import webSearch from "./web-search.js";

const PACKAGE_VERSION = "0.1.0";

export interface PackageDiagnostics {
  cwd: string;
  model: string;
  thinkingLevel: string;
  sessionFile?: string;
  activeTools: string[];
}

export function formatDiagnostics(value: PackageDiagnostics, verbose = false): string {
  const lines = [
    `pi-agent v${PACKAGE_VERSION}`,
    `Workspace: ${value.cwd}`,
    `Model: ${value.model}`,
    `Thinking: ${value.thinkingLevel}`,
    `Session: ${value.sessionFile ?? "ephemeral"}`,
    `Active tools: ${value.activeTools.length}`,
  ];
  if (verbose) lines.push(`Tools: ${value.activeTools.join(", ") || "none"}`);
  return lines.join("\n");
}

function diagnostics(pi: ExtensionAPI, ctx: ExtensionContext): PackageDiagnostics {
  return {
    cwd: ctx.cwd,
    model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "none",
    thinkingLevel: ctx.thinkingLevel ?? "off",
    sessionFile: ctx.sessionManager.getSessionFile() ?? undefined,
    activeTools: pi.getActiveTools(),
  };
}

export default function piAgent(pi: ExtensionAPI): void {
  askUserQuestion(pi);
  glob(pi);
  grep(pi);
  orchestrator(pi);
  codingAgentTui(pi);
  usage(pi);
  webSearch(pi);
  workflowModes(pi);

  pi.registerTool({
    name: "package_diagnostics",
    label: "Package Diagnostics",
    description: "Show the active pi-agent package, workspace, model, session, and tools.",
    parameters: Type.Object({
      verbose: Type.Optional(Type.Boolean({ description: "List active tool names" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const value = diagnostics(pi, ctx);
      return {
        content: [{ type: "text", text: formatDiagnostics(value, params.verbose ?? false) }],
        details: value,
      };
    },
  });

  pi.registerCommand("package-info", {
    description: "Show pi-agent package diagnostics",
    handler: async (args, ctx) => {
      ctx.ui.notify(formatDiagnostics(diagnostics(pi, ctx), args.trim() === "verbose"), "info");
    },
  });
}
