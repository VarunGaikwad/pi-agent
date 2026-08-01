import { createGrepTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function grep(pi: ExtensionAPI) {
  pi.registerTool({
    name: "Grep",
    label: "Grep",
    description:
      "Search file contents using a regular expression or literal string. Returns matching paths, line numbers, and text while respecting .gitignore.",
    promptSnippet: "Search file contents for patterns",
    parameters: Type.Object({
      pattern: Type.String({ description: "Regular expression or literal string to search for" }),
      path: Type.Optional(Type.String({ description: "Directory or file to search (default: current directory)" })),
      glob: Type.Optional(Type.String({ description: "File glob filter, such as '*.ts' or '**/*.test.ts'" })),
      ignoreCase: Type.Optional(Type.Boolean({ description: "Use case-insensitive matching (default: false)" })),
      literal: Type.Optional(Type.Boolean({ description: "Treat pattern as a literal string (default: false)" })),
      context: Type.Optional(Type.Number({ description: "Lines to show before and after each match (default: 0)" })),
      limit: Type.Optional(Type.Number({ description: "Maximum matches to return (default: 100)" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createGrepTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate);
    },
  });
}
