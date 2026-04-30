#!/usr/bin/env node
import { adaptCiCd, adaptConfig, adaptSql } from "./codex-adapter.mjs";
import { analyzeToolCall, checkGatewayHealth } from "./gateway-client.mjs";
import {
  executeCiCdDryRun,
  executeConfigSandbox,
  executeSqlDryRun,
} from "./dry-run-executors.mjs";

const protocolVersion = "2025-06-18";

const textContent = (payload) => ({
  content: [
    {
      type: "text",
      text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
    },
  ],
  structuredContent: typeof payload === "object" ? payload : { message: payload },
});

const toolSchemas = [
  {
    name: "analyze_tool_call",
    description:
      "Analyze a complete agent-safety-gateway ToolCallRequest and return the execution decision without invoking any executor.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["request"],
      properties: {
        request: {
          type: "object",
          description: "A ToolCallRequest object accepted by /api/tool-calls/analyze.",
        },
      },
    },
  },
  {
    name: "safe_sql",
    description:
      "Analyze a SQL request through agent-safety-gateway and invoke only the configured readonly/dry-run SQL executor when allowed.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sql"],
      properties: {
        sql: { type: "string" },
        database: { type: "string" },
        environment: {
          type: "string",
          enum: ["development", "test", "staging", "production", "dev", "prod"],
        },
        taskPurpose: { type: "string" },
        actor: { type: "string" },
        productionWriteNetworkBlocked: { type: "boolean" },
      },
    },
  },
  {
    name: "safe_deploy",
    description:
      "Analyze a CI/CD deploy or rollback request and invoke only the configured dry-run executor when allowed.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["service"],
      properties: {
        service: { type: "string" },
        operation: { type: "string", enum: ["deploy", "rollback"] },
        version: { type: "string" },
        pipeline: { type: "string" },
        stage: { type: "string" },
        testStatus: { type: "string", enum: ["passed", "failed", "unknown"] },
        environment: {
          type: "string",
          enum: ["development", "test", "staging", "production", "dev", "prod"],
        },
        taskPurpose: { type: "string" },
        actor: { type: "string" },
      },
    },
  },
  {
    name: "safe_config_update",
    description:
      "Analyze a configuration update and invoke only the configured sandbox/canary executor for safe decisions.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["service", "key", "value"],
      properties: {
        service: { type: "string" },
        key: { type: "string" },
        value: { type: ["string", "number", "boolean"] },
        previousValue: { type: ["string", "number", "boolean", "null"] },
        namespace: { type: "string" },
        targetNamespace: { type: "string" },
        sandboxNamespace: { type: "string" },
        canaryNamespace: { type: "string" },
        rolloutStrategy: { type: "string", enum: ["sandbox", "canary"] },
        environment: {
          type: "string",
          enum: ["development", "test", "staging", "production", "dev", "prod"],
        },
        taskPurpose: { type: "string" },
        actor: { type: "string" },
      },
    },
  },
  {
    name: "gateway_health",
    description: "Check whether the local agent-safety-gateway API is reachable.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
];

const callTool = async (name, args = {}) => {
  if (name === "gateway_health") {
    return textContent(await checkGatewayHealth());
  }

  if (name === "analyze_tool_call") {
    return textContent(await analyzeToolCall(args.request));
  }

  if (name === "safe_sql") {
    const request = adaptSql(args);
    const analysis = await analyzeToolCall(request);
    const executor = await executeSqlDryRun(request, analysis);

    return textContent({ request, analysis, executor });
  }

  if (name === "safe_deploy") {
    const request = adaptCiCd(args);
    const analysis = await analyzeToolCall(request);
    const executor = await executeCiCdDryRun(request, analysis);

    return textContent({ request, analysis, executor });
  }

  if (name === "safe_config_update") {
    const request = adaptConfig(args);
    const analysis = await analyzeToolCall(request);
    const executor = await executeConfigSandbox(request, analysis);

    return textContent({ request, analysis, executor });
  }

  throw new Error(`Unknown tool '${name}'.`);
};

const success = (id, result) => ({
  jsonrpc: "2.0",
  id,
  result,
});

const failure = (id, error, code = -32603) => ({
  jsonrpc: "2.0",
  id,
  error: {
    code,
    message: error instanceof Error ? error.message : String(error),
    data: error?.payload ?? undefined,
  },
});

const handleRequest = async (message) => {
  if (!message || message.jsonrpc !== "2.0") {
    return null;
  }

  const { id, method, params } = message;

  if (id === undefined || id === null) {
    return null;
  }

  try {
    if (method === "initialize") {
      return success(id, {
        protocolVersion: params?.protocolVersion ?? protocolVersion,
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: "agent-safety-gateway-codex",
          version: "0.1.0",
        },
      });
    }

    if (method === "ping") {
      return success(id, {});
    }

    if (method === "tools/list") {
      return success(id, { tools: toolSchemas });
    }

    if (method === "tools/call") {
      const result = await callTool(params?.name, params?.arguments ?? {});

      return success(id, result);
    }

    if (method === "resources/list") {
      return success(id, { resources: [] });
    }

    if (method === "prompts/list") {
      return success(id, { prompts: [] });
    }

    return failure(id, `Unsupported MCP method '${method}'.`, -32601);
  } catch (error) {
    return failure(id, error);
  }
};

let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);

  buffer = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    let message;

    try {
      message = JSON.parse(line);
    } catch (error) {
      const response = failure(null, `Invalid JSON-RPC message: ${error.message}`, -32700);
      process.stdout.write(`${JSON.stringify(response)}\n`);
      continue;
    }

    void handleRequest(message).then((response) => {
      if (response) {
        process.stdout.write(`${JSON.stringify(response)}\n`);
      }
    });
  }
});
