#!/usr/bin/env node
import { rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const codexDir = resolve(homedir(), ".codex");
const defaultConfigPath = resolve(codexDir, "config.toml");
const defaultHooksPath = resolve(codexDir, "hooks.json");
const statePath = resolve(codexDir, "agent-safety-gateway-install.json");
const mcpName = "agent-safety-gateway";

const readJsonIfExists = async (path) => {
  if (!existsSync(path)) {
    return null;
  }

  return JSON.parse(await readFile(path, "utf8"));
};

const readTextIfExists = async (path) => {
  if (!existsSync(path)) {
    return "";
  }

  return readFile(path, "utf8");
};

const restoreCodexHooksFeature = (config, previous) => {
  if (previous === true) {
    return config;
  }

  if (previous === false) {
    return config.replace(
      /(\[features\][\s\S]*?)(?=\n\[|$)/,
      (section) =>
        /(^|\n)\s*codex_hooks\s*=/.test(section)
          ? section.replace(/(^|\n)(\s*)codex_hooks\s*=\s*(true|false)/, "$1$2codex_hooks = false")
          : section,
    );
  }

  return config
    .replace(/(\n?)\s*codex_hooks\s*=\s*true\s*\n?/m, "$1")
    .replace(/\[features\]\s*(?=\n\[|$)/m, "");
};

const removeHook = async (hooksPath, hookCommand) => {
  if (!existsSync(hooksPath)) {
    return;
  }

  const raw = await readFile(hooksPath, "utf8");
  const hooks = raw.trim() ? JSON.parse(raw) : {};
  const entries = hooks.hooks?.PreToolUse;

  if (!Array.isArray(entries)) {
    return;
  }

  hooks.hooks.PreToolUse = entries
    .map((entry) => ({
      ...entry,
      hooks: Array.isArray(entry.hooks)
        ? entry.hooks.filter((hook) => hook.command !== hookCommand)
        : entry.hooks,
    }))
    .filter((entry) => !Array.isArray(entry.hooks) || entry.hooks.length > 0);

  if (hooks.hooks.PreToolUse.length === 0) {
    delete hooks.hooks.PreToolUse;
  }

  if (hooks.hooks && Object.keys(hooks.hooks).length === 0) {
    delete hooks.hooks;
  }

  if (Object.keys(hooks).length === 0) {
    await rm(hooksPath, { force: true });
    return;
  }

  await writeFile(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);
};

const runCodex = (args) =>
  spawnSync("codex", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const main = async () => {
  const state = await readJsonIfExists(statePath);
  const configPath = state?.configPath ?? defaultConfigPath;
  const hooksPath = state?.hooksPath ?? defaultHooksPath;
  const hookCommand =
    state?.hookCommand ??
    `node ${resolve(process.cwd(), "services/codex/src/pretool-hook.mjs")}`;

  runCodex(["mcp", "remove", state?.mcpName ?? mcpName]);

  await removeHook(hooksPath, hookCommand);

  if (existsSync(configPath)) {
    const config = await readTextIfExists(configPath);
    await writeFile(
      configPath,
      restoreCodexHooksFeature(config, state?.previousFeatureState ?? null),
    );
  }

  await rm(statePath, { force: true });

  process.stdout.write("agent-safety-gateway Codex integration uninstalled.\n");
};

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
