import { basename } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const THEME_NAME = "pi-agent";

export function fitColumns(left: string, right: string, width: number): string {
  if (width <= 0) return "";

  const rightWidth = visibleWidth(right);
  if (rightWidth >= width) return truncateToWidth(right, width, "…");

  const fittedLeft = truncateToWidth(left, width - rightWidth - 1, "…");
  const gap = " ".repeat(Math.max(1, width - visibleWidth(fittedLeft) - rightWidth));
  return truncateToWidth(`${fittedLeft}${gap}${right}`, width, "");
}

export default function minimalTui(pi: ExtensionAPI): void {
  let workflowMode = "code";
  let requestRender: (() => void) | undefined;

  pi.events.on("workflow-mode:changed", (value) => {
    if (typeof value === "string") workflowMode = value;
    requestRender?.();
  });

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    if (ctx.ui.theme.name === "dark") {
      const theme = ctx.ui.getTheme(THEME_NAME);
      if (theme) ctx.ui.setTheme(theme);
    }

    const project = basename(ctx.cwd) || "workspace";
    ctx.ui.setTitle(`${project} — pi`);
    ctx.ui.setHeader((_tui, theme) => ({
      render: (width) => [
        truncateToWidth(
          `${theme.fg("accent", theme.bold("pi"))} ${theme.fg("muted", project)}`,
          width,
          "…",
        ),
      ],
      invalidate() {},
    }));

    ctx.ui.setFooter((tui, _theme, footerData) => {
      requestRender = () => tui.requestRender();
      const unsubscribe = footerData.onBranchChange(requestRender);
      return {
        dispose() {
          requestRender = undefined;
          unsubscribe();
        },
        invalidate() {},
        render(width: number): string[] {
          const theme = ctx.ui.theme;
          const model = ctx.model?.id ?? "no model";
          const thinking = ctx.thinkingLevel && ctx.thinkingLevel !== "off"
            ? ` · ${ctx.thinkingLevel}`
            : "";
          const usage = ctx.getContextUsage()?.percent;
          const context = usage == null ? "ctx —" : `ctx ${Math.round(usage)}%`;
          const branch = footerData.getGitBranch();
          const left = `${theme.fg("text", model)}${theme.fg("dim", thinking)}${theme.fg("accent", ` · ${workflowMode}`)}`;
          const right = `${branch ? `${theme.fg("muted", branch)} · ` : ""}${theme.fg("dim", context)}`;
          return [fitColumns(left, right, width)];
        },
      };
    });
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    requestRender = undefined;
    ctx.ui.setHeader(undefined);
    ctx.ui.setFooter(undefined);
  });
}
