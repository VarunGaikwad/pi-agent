import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const BRAND_NAME = "PI AGENT";
const THEME_NAME = "pi-agent";

let enabled = true;
let workflowMode = "code";
let thinkingLevel: ReturnType<ExtensionAPI["getThinkingLevel"]> = "off";
let applyInterface: (() => void) | undefined;
let restoreDefaults: (() => void) | undefined;
let restoreIdleTitle: (() => void) | undefined;
let requestRender: (() => void) | undefined;

function formatNumber(value: number): string {
  if (value < 1_000) return `${value}`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(1)}m`;
}

function compactPath(path: string): string {
  const home = homedir();
  return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function fitCell(text: string, width: number): string {
  if (width <= 0) return "";
  const clipped = truncateToWidth(text, width, "…");
  return `${clipped}${" ".repeat(Math.max(0, width - visibleWidth(clipped)))}`;
}

function centerCell(text: string, width: number): string {
  if (width <= 0) return "";
  const clipped = truncateToWidth(text, width, "…");
  const padding = Math.max(0, width - visibleWidth(clipped));
  const left = Math.floor(padding / 2);
  return `${" ".repeat(left)}${clipped}${" ".repeat(padding - left)}`;
}

export function fitColumns(left: string, right: string, width: number): string {
  if (width <= 0) return "";
  const rightWidth = visibleWidth(right);
  if (rightWidth >= width) return truncateToWidth(right, width, "…");
  const fittedLeft = truncateToWidth(left, width - rightWidth - 1, "…");
  const gap = " ".repeat(Math.max(1, width - visibleWidth(fittedLeft) - rightWidth));
  return truncateToWidth(`${fittedLeft}${gap}${right}`, width, "");
}

function topBorder(theme: Theme, title: string, width: number): string {
  if (width < 8) return truncateToWidth(theme.fg("accent", title), width, "");
  const label = truncateToWidth(` ${title} `, Math.max(1, width - 3), "…");
  const remaining = Math.max(0, width - visibleWidth(label) - 3);
  return `${theme.fg("accent", "╭─")}${theme.fg("accent", label)}${theme.fg("accent", `${"─".repeat(remaining)}╮`)}`;
}

function bottomBorder(theme: Theme, width: number): string {
  if (width < 2) return "";
  return theme.fg("accent", `╰${"─".repeat(width - 2)}╯`);
}

function panelLine(theme: Theme, content: string, width: number): string {
  if (width < 4) return truncateToWidth(content, width, "");
  return `${theme.fg("accent", "│")} ${fitCell(content, width - 4)} ${theme.fg("accent", "│")}`;
}

function splitWidths(width: number): { left: number; right: number } {
  const available = Math.max(0, width - 7);
  const left = Math.min(42, Math.max(26, Math.floor(available * 0.34)));
  return { left, right: Math.max(0, available - left) };
}

function splitPanelLine(
  theme: Theme,
  leftText: string,
  rightText: string,
  width: number,
  leftWidth: number,
  rightWidth: number,
): string {
  return panelLine(
    theme,
    `${fitCell(leftText, leftWidth)} ${theme.fg("dim", "│")} ${fitCell(rightText, rightWidth)}`,
    width,
  );
}

function mascot(theme: Theme): string[] {
  return [
    theme.fg("accent", "   ╭─────╮   "),
    `${theme.fg("accent", "╭──┤")} ${theme.bold("π")} ${theme.fg("accent", "├──╮")}`,
    `${theme.fg("accent", "│  ╰─────╯  │")}`,
    `${theme.fg("accent", "╰─┬───────┬─╯")}`,
    `${theme.fg("accent", "  ╰─╮   ╭─╯  ")}`,
  ];
}

function renderWideHeader(theme: Theme, width: number, modelId: string, cwd: string): string[] {
  const { left: leftWidth, right: rightWidth } = splitWidths(width);
  const modelLine = [
    theme.fg("muted", truncateToWidth(modelId, Math.max(8, leftWidth - 12), "…")),
    theme.fg("dim", " · "),
    thinkingLevel === "off"
      ? theme.fg("dim", "think off")
      : theme.fg("accent", `think ${thinkingLevel}`),
  ].join("");

  const leftColumn = [
    centerCell(theme.bold("Ready to build"), leftWidth),
    "",
    ...mascot(theme).map((line) => centerCell(line, leftWidth)),
    centerCell(modelLine, leftWidth),
    centerCell(theme.fg("dim", compactPath(cwd)), leftWidth),
  ];
  const rightColumn = [
    theme.fg("accent", theme.bold("Coding workspace")),
    theme.fg("text", "Describe a change, paste an error, or ask about the repository"),
    theme.fg("accent", "─".repeat(rightWidth)),
    theme.fg("accent", theme.bold("Workflows")),
    `${theme.fg("accent", "/code")} implement focused changes`,
    `${theme.fg("accent", "/plan")} inspect and design without editing`,
    `${theme.fg("accent", "/debug")} reproduce, diagnose, fix, verify`,
    `${theme.fg("accent", "/orchestrator")} delegate to specialist agents`,
    theme.fg("muted", "/help for commands · ? for shortcuts"),
  ];

  const lines = [topBorder(theme, `${BRAND_NAME} v${VERSION} · ${workflowMode}`, width)];
  for (let index = 0; index < Math.max(leftColumn.length, rightColumn.length); index++) {
    lines.push(splitPanelLine(theme, leftColumn[index] ?? "", rightColumn[index] ?? "", width, leftWidth, rightWidth));
  }
  lines.push(bottomBorder(theme, width));
  return lines;
}

function renderCompactHeader(theme: Theme, width: number, modelId: string, cwd: string): string[] {
  const inner = Math.max(0, width - 4);
  const lines = [topBorder(theme, `${BRAND_NAME} v${VERSION}`, width)];
  lines.push(panelLine(theme, centerCell(theme.bold("Ready to build"), inner), width));
  lines.push(panelLine(theme, "", width));
  for (const line of mascot(theme)) lines.push(panelLine(theme, centerCell(line, inner), width));
  lines.push(panelLine(theme, "", width));
  lines.push(panelLine(theme, centerCell(theme.fg("muted", modelId), inner), width));
  lines.push(panelLine(theme, centerCell(theme.fg("dim", compactPath(cwd)), inner), width));
  lines.push(panelLine(theme, theme.fg("accent", "─".repeat(inner)), width));
  lines.push(panelLine(theme, `${theme.bold("mode")} ${theme.fg("accent", workflowMode)} · /help · ? shortcuts`, width));
  lines.push(bottomBorder(theme, width));
  return lines;
}

function renderHeader(theme: Theme, width: number, modelId: string, cwd: string): string[] {
  if (width <= 0) return [];
  return ["", ...(width < 72
    ? renderCompactHeader(theme, width, modelId, cwd)
    : renderWideHeader(theme, width, modelId, cwd)), ""];
}

export default function codingAgentTui(pi: ExtensionAPI): void {
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

    const cwd = resolve(ctx.cwd ?? process.cwd());
    const project = basename(cwd) || "workspace";
    thinkingLevel = pi.getThinkingLevel();
    restoreIdleTitle = () => ctx.ui.setTitle(`${BRAND_NAME} — ${project}`);

    applyInterface = () => {
      restoreIdleTitle?.();
      ctx.ui.setHeader((tui, theme) => {
        requestRender = () => tui.requestRender();
        return {
          render: (width) => renderHeader(theme, width, ctx.model?.id ?? "no model selected", cwd),
          invalidate() {},
        };
      });

      ctx.ui.setFooter((tui, theme, footerData) => {
        requestRender = () => tui.requestRender();
        const unsubscribe = footerData.onBranchChange(requestRender);
        return {
          dispose: unsubscribe,
          invalidate() {},
          render(width: number): string[] {
            let inputTokens = 0;
            let outputTokens = 0;
            let cost = 0;
            for (const entry of ctx.sessionManager.getBranch()) {
              if (entry.type !== "message" || entry.message.role !== "assistant") continue;
              inputTokens += entry.message.usage?.input ?? 0;
              outputTokens += entry.message.usage?.output ?? 0;
              cost += entry.message.usage?.cost?.total ?? 0;
            }

            const statuses = [...footerData.getExtensionStatuses().values()].filter(Boolean);
            const state = statuses.length ? statuses.join(" · ") : "ready";
            const left = [
              theme.fg("accent", "▌"),
              theme.fg("accent", workflowMode),
              theme.fg("muted", state),
              theme.fg("dim", "· ? shortcuts · ← agents"),
            ].join(" ");
            const branch = footerData.getGitBranch();
            const thinking = thinkingLevel === "off"
              ? theme.fg("dim", "think off")
              : `${theme.fg("accent", "✦")} ${theme.bold(`think ${thinkingLevel}`)}`;
            const right = [
              thinking,
              theme.fg("muted", truncateToWidth(ctx.model?.id ?? "no model", 24, "…")),
              branch ? theme.fg("dim", `git:${branch}`) : undefined,
              theme.fg("dim", `↑${formatNumber(inputTokens)} ↓${formatNumber(outputTokens)} $${cost.toFixed(3)}`),
            ].filter((part): part is string => Boolean(part)).join(theme.fg("dim", " · "));
            return [fitColumns(left, right, width)];
          },
        };
      });

      ctx.ui.setWorkingIndicator({ frames: ["·  ", "·· ", "···", " ··"], intervalMs: 110 });
      ctx.ui.setWorkingMessage(`${BRAND_NAME} is working`);
      ctx.ui.setHiddenThinkingLabel("Thinking");
    };

    restoreDefaults = () => {
      ctx.ui.setHeader(undefined);
      ctx.ui.setFooter(undefined);
      requestRender = undefined;
      ctx.ui.setWorkingIndicator();
      ctx.ui.setWorkingMessage();
      ctx.ui.setHiddenThinkingLabel();
      ctx.ui.setTitle("Pi");
    };

    if (enabled) applyInterface();
  });

  pi.on("thinking_level_select", (event) => {
    thinkingLevel = event.level;
    requestRender?.();
  });
  pi.on("model_select", () => {
    thinkingLevel = pi.getThinkingLevel();
    requestRender?.();
  });
  pi.on("agent_start", (_event, ctx) => {
    if (enabled && ctx.mode === "tui") ctx.ui.setTitle(`● ${BRAND_NAME} — working`);
  });
  pi.on("agent_settled", (_event, ctx) => {
    if (enabled && ctx.mode === "tui") restoreIdleTitle?.();
  });
  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.mode === "tui") restoreDefaults?.();
  });

  pi.registerCommand("pi-agent-ui", {
    description: "Toggle the Pi Agent interface",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") return;
      enabled = !enabled;
      if (enabled) {
        applyInterface?.();
        ctx.ui.notify("Pi Agent interface enabled", "info");
      } else {
        restoreDefaults?.();
        ctx.ui.notify("Pi Agent interface disabled", "info");
      }
    },
  });
}
