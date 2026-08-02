import { realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export type GuardDecision = { action: "allow" | "confirm" | "block"; reason?: string };

const DANGEROUS_SHELL = [
  /(?:^|[;&|]\s*)(?:sudo|su|doas)(?:\s|$)/iu,
  /(?:^|[;&|]\s*)(?:rm|rmdir|shred|wipefs|mkfs(?:\.\w+)?|fdisk|parted|dd)(?:\s|$)/iu,
  /(?:^|[;&|]\s*)(?:chmod|chown|chgrp|mount|umount)(?:\s|$)/iu,
  /(?:^|[;&|]\s*)(?:shutdown|reboot|poweroff|halt|systemctl|service)(?:\s|$)/iu,
  /(?:^|[;&|]\s*)(?:kill|killall|pkill)(?:\s|$)/iu,
  /(?:^|[;&|]\s*)git\s+(?:push|clean|rebase)(?:\s|$)/iu,
  /(?:^|[;&|]\s*)git\s+reset\b[^\n;&|]*--hard\b/iu,
  /(?:^|[;&|]\s*)git\s+(?:checkout|restore)\b[^\n;&|]*(?:--force\b|\s--(?:\s|$))/iu,
  /(?:^|[;&|]\s*)git\s+branch\b[^\n;&|]*\s-D(?:\s|$)/iu,
  /(?:^|[;&|]\s*)git\s+stash\s+(?:drop|clear)(?:\s|$)/iu,
  /(?:^|[;&|]\s*)git\s+worktree\s+(?:remove|prune)(?:\s|$)/iu,
  /(?:curl|wget)[^\n|;]*(?:\||;|&&)\s*(?:sh|bash|zsh|fish|node|python\d*)\b/iu,
  /(?:^|\s)(?:\/etc|\/usr|\/bin|\/sbin|\/boot|\/root|\/var|\/dev|\/proc|\/sys)(?:\/|\s|$)/u,
  /(?:^|\s)(?:npm|pnpm|yarn)\s+(?:install|add|remove|uninstall)\b[^\n]*(?:\s-g\b|--global\b)/iu,
];

const SENSITIVE_PATH = /(?:^|\/)(?:\.env(?:\..*)?|\.git|\.ssh|\.gnupg|credentials?|secrets?)(?:\/|$)/iu;

function inside(workspace: string, path: string): boolean {
  const rel = relative(workspace, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    try {
      return resolve(realpathSync(dirname(path)), path.slice(dirname(path).length + 1));
    } catch {
      return resolve(path);
    }
  }
}

export function guardFileWrite(path: string, cwd: string): GuardDecision {
  const workspace = canonical(cwd);
  const target = canonical(resolve(cwd, path.replace(/^@/, "")));
  if (!inside(workspace, target)) {
    return { action: "block", reason: `Guard blocked a write outside the workspace: ${target}` };
  }
  const rel = relative(workspace, target).replaceAll("\\", "/");
  if (SENSITIVE_PATH.test(rel)) {
    return { action: "confirm", reason: `Write sensitive path ${rel || "."}?` };
  }
  return { action: "allow" };
}

export function guardBash(command: string): GuardDecision {
  if (DANGEROUS_SHELL.some((pattern) => pattern.test(command))) {
    return { action: "confirm", reason: `Run potentially destructive command?\n\n${command}` };
  }
  return { action: "allow" };
}

async function enforce(decision: GuardDecision, ctx: ExtensionContext): Promise<{ block: true; reason: string } | undefined> {
  if (decision.action === "allow") return;
  if (decision.action === "block") return { block: true, reason: decision.reason ?? "Blocked by system guard" };
  if (!ctx.hasUI || !await ctx.ui.confirm("System guard", decision.reason ?? "Allow this operation?")) {
    return { block: true, reason: "System guard denied the operation" };
  }
}

export default function systemGuard(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if ((event.toolName === "write" || event.toolName === "edit") && typeof event.input.path === "string") {
      return enforce(guardFileWrite(event.input.path, ctx.cwd), ctx);
    }
    if (event.toolName === "bash" && typeof event.input.command === "string") {
      return enforce(guardBash(event.input.command), ctx);
    }
  });
}
