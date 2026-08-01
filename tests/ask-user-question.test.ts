import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import askUserQuestion from "../extensions/ask-user-question.js";

function registeredTool() {
  const registerTool = vi.fn();
  askUserQuestion({ registerTool } as unknown as ExtensionAPI);
  return registerTool.mock.calls[0][0];
}

const question = {
  header: "Scope",
  question: "Which scope?",
  options: [
    { label: "Small", description: "Minimal change" },
    { label: "Large", description: "Broader change" },
  ],
  multiSelect: false,
};

describe("AskUserQuestion", () => {
  it("returns the selected option", async () => {
    const tool = registeredTool();
    const select = vi.fn(async (_title: string, choices: string[]) => choices[0]);

    const output = await tool.execute(
      "call",
      { questions: [question] },
      undefined,
      undefined,
      { hasUI: true, ui: { select } },
    );

    expect(output.details).toEqual({
      answers: [{ header: "Scope", question: "Which scope?", answer: "Small" }],
      cancelled: false,
    });
  });

  it("collects multiple selections until Done", async () => {
    const tool = registeredTool();
    const select = vi
      .fn()
      .mockImplementationOnce(async (_title: string, choices: string[]) => choices[1])
      .mockResolvedValueOnce("Done");

    const output = await tool.execute(
      "call",
      { questions: [{ ...question, multiSelect: true }] },
      undefined,
      undefined,
      { hasUI: true, ui: { select } },
    );

    expect(output.details.answers[0].answer).toBe("Large");
  });
});
