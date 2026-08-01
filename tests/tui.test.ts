import { describe, expect, it } from "vitest";
import { fitColumns } from "../extensions/tui.js";

const plain = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, "");

describe("fitColumns", () => {
  it("fits both columns within the terminal width", () => {
    expect(fitColumns("model", "ctx 10%", 20)).toBe("model        ctx 10%");
    expect(plain(fitColumns("a very long model", "ctx 10%", 12))).toBe("a v… ctx 10%");
    expect(plain(fitColumns("model", "ctx 10%", 5))).toBe("ctx …");
    expect(fitColumns("model", "ctx 10%", 0)).toBe("");
  });
});
