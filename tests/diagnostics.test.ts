import { describe, expect, it } from "vitest";
import { formatDiagnostics, type PackageDiagnostics } from "../extensions/index.js";

const diagnostics: PackageDiagnostics = {
  cwd: "/workspace/example",
  model: "provider/model",
  thinkingLevel: "high",
  sessionFile: "/tmp/session.jsonl",
  activeTools: ["read", "write"],
};

describe("formatDiagnostics", () => {
  it("renders a concise summary by default", () => {
    const output = formatDiagnostics(diagnostics);

    expect(output).toContain("pi-agent v0.1.0");
    expect(output).toContain("Workspace: /workspace/example");
    expect(output).toContain("Active tools: 2");
    expect(output).not.toContain("Tools: read, write");
  });

  it("lists tools in verbose mode", () => {
    expect(formatDiagnostics(diagnostics, true)).toContain("Tools: read, write");
  });
});
