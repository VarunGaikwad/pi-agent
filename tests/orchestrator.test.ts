import { describe, expect, it } from "vitest";
import {
  discoverAgents,
  parseAgentDefinition,
  parseAgentModels,
  resolveAgentModel,
} from "../extensions/orchestrator/agents.js";
import { canRunInParallel, parseJsonRun } from "../extensions/orchestrator/index.js";

const agentSource = `---
name: scout
description: Finds relevant code
tools: read, grep
model: provider/fast-model:low
read-only: true
---
Inspect the repository without changing it.
`;

describe("orchestrator agents", () => {
  it("parses agent configuration and uses its model override", () => {
    const agent = parseAgentDefinition(agentSource, "bundled", "/agents/scout.md");
    expect(agent).toMatchObject({
      name: "scout",
      tools: ["read", "grep"],
      model: "provider/fast-model:low",
      readOnly: true,
    });
    expect(resolveAgentModel(agent!, "provider/parent:high")).toBe("provider/fast-model:low");
    expect(resolveAgentModel({ ...agent!, model: undefined }, "provider/parent:high"))
      .toBe("provider/parent:high");
    expect(canRunInParallel([agent!])).toBe(true);
  });

  it("loads central model assignments with comments and trailing commas", () => {
    const models = parseAgentModels(`{
      // Pi provider definitions remain untouched.
      "providers": {},
      "agents": {
        "scout": "provider/central-model:high",
      },
    }`);
    const agent = parseAgentDefinition(agentSource, "bundled", "/agents/scout.md")!;

    expect(resolveAgentModel(agent, "provider/parent:high", models)).toBe("provider/central-model:high");
    expect(parseAgentModels('{"providers": {}}')).toEqual({});
    expect(() => parseAgentModels('{"providers": {}, "agents": []}')).toThrow("agents must be an object");
  });

  it("discovers the bundled specialist roles", () => {
    expect(discoverAgents(process.cwd(), false).map((agent) => agent.name).sort()).toEqual([
      "debugger", "planner", "reviewer", "scout", "worker",
    ]);
  });

  it("extracts the final assistant output and billed usage from JSON mode", () => {
    const stdout = [
      JSON.stringify({
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "first" }],
          usage: {
            input: 10,
            output: 2,
            cacheRead: 3,
            cacheWrite: 1,
            totalTokens: 16,
            cost: { input: 0.1, output: 0.2, cacheRead: 0.03, cacheWrite: 0.01, total: 0.34 },
          },
        },
      }),
      JSON.stringify({
        type: "message_end",
        message: { role: "assistant", content: [{ type: "text", text: "final" }] },
      }),
    ].join("\n");

    expect(parseJsonRun(stdout)).toMatchObject({
      output: "final",
      usage: { input: 10, output: 2, totalTokens: 16, cost: { total: 0.34 } },
    });
  });
});
