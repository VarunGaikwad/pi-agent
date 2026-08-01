import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
  calculateSessionUsage,
  formatCost,
  formatDuration,
  formatUsageReport,
} from "../extensions/usage.js";

function usage(input: number, output: number, cacheRead = 0, cacheWrite = 0, cost = 0.1) {
  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    totalTokens: input + output + cacheRead + cacheWrite,
    cost: {
      input: cost * 0.2,
      output: cost * 0.7,
      cacheRead: cost * 0.05,
      cacheWrite: cost * 0.05,
      total: cost,
    },
  };
}

const entries = [
  {
    type: "message",
    id: "assistant",
    parentId: null,
    timestamp: new Date(5_000).toISOString(),
    message: {
      role: "assistant",
      content: [
        { type: "toolCall", id: "edit-call", name: "edit", arguments: {} },
        {
          type: "toolCall",
          id: "write-call",
          name: "write",
          arguments: { path: "new.ts", content: "one\ntwo\n" },
        },
      ],
      api: "openai-responses",
      provider: "openai",
      model: "router",
      responseModel: "gpt-test",
      usage: usage(100, 20, 80, 5, 0.1),
      stopReason: "stop",
      timestamp: 0,
    },
  },
  {
    type: "message",
    id: "tool",
    parentId: "assistant",
    timestamp: new Date(6_000).toISOString(),
    message: {
      role: "toolResult",
      toolCallId: "call",
      toolName: "nested",
      content: [],
      usage: usage(10, 2, 0, 0, 0.02),
      isError: false,
      timestamp: 6_000,
    },
  },
  {
    type: "message",
    id: "edit-result",
    parentId: "tool",
    timestamp: new Date(7_000).toISOString(),
    message: {
      role: "toolResult",
      toolCallId: "edit-call",
      toolName: "edit",
      content: [],
      details: { patch: "--- a/file.ts\n+++ b/file.ts\n@@ -1 +1,2 @@\n-old\n+new\n+extra" },
      isError: false,
      timestamp: 7_000,
    },
  },
  {
    type: "message",
    id: "write-result",
    parentId: "edit-result",
    timestamp: new Date(8_000).toISOString(),
    message: {
      role: "toolResult",
      toolCallId: "write-call",
      toolName: "write",
      content: [],
      isError: false,
      timestamp: 8_000,
    },
  },
] as unknown as SessionEntry[];

describe("calculateSessionUsage", () => {
  it("totals billed usage, API time, and reported file changes", () => {
    const result = calculateSessionUsage(entries);

    expect(result.input).toBe(110);
    expect(result.output).toBe(22);
    expect(result.cacheRead).toBe(80);
    expect(result.cacheWrite).toBe(5);
    expect(result.cost.total).toBeCloseTo(0.12);
    expect(result.apiDurationMs).toBe(5_000);
    expect([result.linesAdded, result.linesRemoved]).toEqual([4, 1]);
  });
});

describe("formatUsageReport", () => {
  it("matches the compact Session layout", () => {
    expect(formatUsageReport(calculateSessionUsage(entries), 149_000)).toBe(
      [
        "Session",
        "",
        "  Total cost:            $0.1200",
        "  Total duration (API):  5s",
        "  Total duration (wall): 2m 29s",
        "  Total code changes:    4 lines added, 1 line removed",
        "  Usage:                 110 input, 22 output, 80 cache read, 5 cache write",
      ].join("\n"),
    );
  });

  it("formats durations and tiny costs", () => {
    expect(formatDuration(3_661_000)).toBe("1h 1m 1s");
    expect(formatCost(0.0000123)).toBe("$0.000012");
  });
});
