import { createFindTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function glob(pi: ExtensionAPI) {
  pi.registerTool({
    name: "Glob",
    label: "Glob",
    description:
      "Find files by glob pattern. Returns paths relative to the search directory and respects .gitignore.",
    promptSnippet: "Find files by glob pattern",
    parameters: Type.Object({
      pattern: Type.String({ description: "Glob pattern, such as '**/*.ts' or 'src/**/*.test.ts'" }),
      path: Type.Optional(Type.String({ description: "Directory to search (default: current directory)" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createFindTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate);
    },
  });
}
