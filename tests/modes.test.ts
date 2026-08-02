import { describe, expect, it } from "vitest";
import { isReadOnlyCommand, toolsForMode } from "../extensions/modes.js";

const available = ["read", "bash", "edit", "write", "Glob", "Grep", "WebSearch", "AskUserQuestion", "subagent"];
const full = [...available];

describe("workflow modes", () => {
  it("restricts tools by mode and exposes subagents only to orchestrator", () => {
    expect(toolsForMode("code", available, full)).not.toContain("subagent");
    expect(toolsForMode("ask", available, full)).toEqual([
      "read", "Glob", "Grep", "WebSearch", "AskUserQuestion",
    ]);
    expect(toolsForMode("plan", available, full)).toContain("bash");
    expect(toolsForMode("plan", available, full)).not.toContain("edit");
    expect(toolsForMode("orchestrator", available, full)).toContain("subagent");
  });

  it("allows simple inspection commands but rejects shell composition and mutations", () => {
    expect(isReadOnlyCommand("git diff --stat")).toBe(true);
    expect(isReadOnlyCommand("rg workflow extensions")).toBe(true);
    expect(isReadOnlyCommand("git diff && rm -rf .")).toBe(false);
    expect(isReadOnlyCommand("cat file > copy")).toBe(false);
    expect(isReadOnlyCommand("npm test")).toBe(false);
  });
});
