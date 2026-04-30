#!/usr/bin/env node
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const codexDir = resolve(homedir(), ".codex");
const configPath = resolve(codexDir, "config.toml");
const hooksPath = resolve(codexDir, "hooks.json");
const statePath = resolve(codexDir, "agent-safety-gateway-install.json");
const backupDir = resolve(codexDir, "backups");
const mcpName = "agent-safety-gateway";
const mcpServerPath = resolve(repoRoot, "services/codex/src/mcp-server.mjs");
const hookPath = resolve(repoRoot, "services/codex/src/pretool-hook.mjs");
const hookCommand = `node ${hookPath}`;

const readTextIfExists = async (path) => {
  if (!existsSync(path)) {
    return "";
  }

  return readFile(path, "utf8");
};

const backupFile = async (path, timestamp) => {
  if (!existsSync(path)) {
    return null;
  }

  await mkdir(backupDir, { recursive: true });
  const backupPath = resolve(backupDir, `${timestamp}-${path.split("/").pop()}`);

  await copyFile(path, backupPath);
  return backupPath;
};

const getFeatureState = (config) => {
  const section = /\[features\]([\s\S]*?)(?=\n\[|$)/.exec(config)?.[1] ?? "";
  const match = /^\s*codex_hooks\s*=\s*(true|false)\s*$/im.exec(section);

  if (!match) {
    return null;
  }

  return match[1] === "true";
};

const enableCodexHooks = (config) => {
  if (/\[features\]/.test(config)) {
    const sectionMatch = /\[features\]([\s\S]*?)(?=\n\[|$)/.exec(config);

    if (!sectionMatch) {
      return `${config.trimEnd()}\n\n[features]\ncodex_hooks = true\n`;
    }

    const section = sectionMatch[0];
    const updatedSection = /(^|\n)\s*codex_hooks\s*=/.test(section)
      ? section.replace(/(^|\n)(\s*)codex_hooks\s*=\s*(true|false)/, "$1$2codex_hooks = true")
      : `${section.trimEnd()}\ncodex_hooks = true`;

    return `${config.slice(0, sectionMatch.index)}${updatedSection}${config.slice(
      sectionMatch.index + section.length,
    )}`;
  }

  return `${config.trimEnd()}\n\n[features]\ncodex_hooks = true\n`;
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

const upsertHook = async () => {
  let hooks = {};
  const existing = await readTextIfExists(hooksPath);

  if (existing.trim()) {
    hooks = JSON.parse(existing);
  }

  hooks.hooks ??= {};
  hooks.hooks.PreToolUse ??= [];

  const alreadyConfigured = hooks.hooks.PreToolUse.some((entry) =>
    Array.isArray(entry.hooks)
      ? entry.hooks.some((hook) => hook.command === hookCommand)
      : false,
  );

  if (!alreadyConfigured) {
    hooks.hooks.PreToolUse.push({
      matcher: "Bash|Shell|exec|exec_command|functions.exec_command",
      hooks: [
        {
          type: "command",
          command: hookCommand,
          timeout: 30,
        },
      ],
    });
  }

  await writeFile(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);
};

const runCodex = (args) =>
  spawnSync("codex", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const configureMcp = () => {
  runCodex(["mcp", "remove", mcpName]);
  const result = runCodex([
    "mcp",
    "add",
    mcpName,
    "--env",
    `ASG_GATEWAY_URL=${process.env.ASG_GATEWAY_URL ?? "http://127.0.0.1:4310"}`,
    "--",
    "node",
    mcpServerPath,
  ]);

  if (result.status !== 0) {
    throw new Error(
      `codex mcp add failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
};

const main = async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  await mkdir(codexDir, { recursive: true });
  await mkdir(dirname(configPath), { recursive: true });

  if (!existsSync(configPath)) {
    await writeFile(configPath, "");
  }

  const previousConfig = await readTextIfExists(configPath);
  const previousFeatureState = getFeatureState(previousConfig);
  const configBackup = await backupFile(configPath, timestamp);
  const hooksBackup = await backupFile(hooksPath, timestamp);

  await writeFile(configPath, enableCodexHooks(previousConfig));
  await upsertHook();
  configureMcp();

  await writeFile(
    statePath,
    `${JSON.stringify(
      {
        installedAt: new Date().toISOString(),
        repoRoot,
        mcpName,
        mcpServerPath,
        hookPath,
        hookCommand,
        configPath,
        hooksPath,
        configBackup,
        hooksBackup,
        previousFeatureState,
      },
      null,
      2,
    )}\n`,
  );

  process.stdout.write(
    [
      "agent-safety-gateway Codex integration installed.",
      `MCP server: ${mcpName}`,
      `PreToolUse hook: ${hookPath}`,
      `State file: ${statePath}`,
    ].join("\n"),
  );
  process.stdout.write("\n");
};

main().catch(async (error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});

export { restoreCodexHooksFeature };
