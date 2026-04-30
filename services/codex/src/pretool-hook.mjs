#!/usr/bin/env node
import { adaptBashCommand } from "./codex-adapter.mjs";
import { analyzeToolCall } from "./gateway-client.mjs";
import { persistHookDecision } from "./hook-decision-store.mjs";

const readStdin = () =>
  new Promise((resolve) => {
    let input = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
  });

const getToolName = (payload) =>
  payload.tool_name ??
  payload.toolName ??
  payload.name ??
  payload.tool?.name ??
  payload.params?.tool_name ??
  payload.params?.name;

const getToolInput = (payload) =>
  payload.tool_input ??
  payload.toolInput ??
  payload.input ??
  payload.params?.tool_input ??
  payload.params?.arguments ??
  {};

const getCommand = (payload) => {
  const input = getToolInput(payload);

  return (
    input.command ??
    input.cmd ??
    input.args?.command ??
    payload.command ??
    payload.params?.command ??
    null
  );
};

const deny = (reason) => {
  process.stdout.write(
    `${JSON.stringify({
      should_block: true,
      block_reason: reason,
    })}\n`,
  );
};

const persistBlock = async ({ toolName, command, cwd, adaptedRequest, reason, auditId }) => {
  await persistHookDecision({
    toolName,
    command,
    cwd,
    adaptedRequest,
    blockReason: reason,
    shouldBlock: true,
    auditId,
  });
};

const denyAndPersist = async (context) => {
  await persistBlock(context);
  deny(context.reason);
};

const isShellTool = (toolName) =>
  !toolName ||
  /^(Bash|Shell|shell|exec|exec_command|functions\.exec_command)$/i.test(String(toolName));

const summarizeAnalysis = (analysis) => {
  const decision = analysis.executionDecision;
  const reason = decision?.reason ?? "No decision reason was returned.";

  return `agent-safety-gateway decision=${decision?.type ?? "unknown"} risk=${analysis.riskLevel ?? "unknown"} code=${decision?.code ?? "unknown"}. ${reason}`;
};

const main = async () => {
  const raw = await readStdin();

  if (!raw.trim()) {
    return;
  }

  let payload;

  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  const toolName = getToolName(payload);

  if (!isShellTool(toolName)) {
    return;
  }

  const command = getCommand(payload);
  const cwd = getToolInput(payload).cwd ?? payload.cwd;

  if (!command) {
    return;
  }

  const adapted = adaptBashCommand({
    command,
    cwd,
  });

  if (!adapted) {
    return;
  }

  if (adapted.kind === "local_block" || adapted.kind === "unparsed_sql") {
    await denyAndPersist({
      toolName,
      command,
      cwd,
      reason: adapted.localBlockReason,
    });
    return;
  }

  if (adapted.unsupportedDestructiveSql) {
    await denyAndPersist({
      toolName,
      command,
      cwd,
      adaptedRequest: adapted.request,
      reason:
        "Codex attempted SQL that is destructive and currently outside the gateway SQL parser support. Use the safe_sql MCP tool with a dry-run executor or add parser support first.",
    });
    return;
  }

  try {
    const analysis = await analyzeToolCall(adapted.request, { timeoutMs: 3000 });
    const decisionType = analysis.executionDecision?.type;

    if (decisionType !== "allow" || analysis.riskLevel === "prohibited") {
      await denyAndPersist({
        toolName,
        command,
        cwd,
        adaptedRequest: adapted.request,
        reason: summarizeAnalysis(analysis),
        auditId: analysis.auditId,
      });
    }
  } catch (error) {
    await denyAndPersist({
      toolName,
      command,
      cwd,
      adaptedRequest: adapted.request,
      reason: `agent-safety-gateway could not analyze a high-risk Codex Bash command, so the hook failed closed. ${error.message}`,
    });
  }
};

main().catch((error) => {
  deny(`agent-safety-gateway hook failed closed: ${error.message}`);
});
