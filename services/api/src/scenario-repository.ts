import { readFile } from "node:fs/promises";

import type {
  DecisionType,
  RiskLevel,
  ToolCallRequest,
} from "@agent-safety-gateway/shared";

import type { LocalStorageLayout } from "./storage.js";

export type ScenarioRecord = {
  id: string;
  name: string;
  description: string;
  toolCallRequest: ToolCallRequest;
  expectedRiskLevel: RiskLevel;
  expectedDecision: DecisionType;
};

export type ScenarioRepository = {
  listScenarios: () => Promise<ScenarioRecord[]>;
  getScenarioById: (scenarioId: string) => Promise<ScenarioRecord | null>;
};

const readScenarioStore = async (
  filePath: string,
): Promise<ScenarioRecord[]> => {
  const rawContent = await readFile(filePath, "utf8");
  const parsedContent: unknown = JSON.parse(rawContent);

  if (!Array.isArray(parsedContent)) {
    throw new Error("Invalid scenarios store: expected a JSON array.");
  }

  return parsedContent as ScenarioRecord[];
};

export const createScenarioRepository = (
  layout: LocalStorageLayout,
): ScenarioRepository => {
  const listScenarios = () => readScenarioStore(layout.stores.scenarios);

  return {
    listScenarios,
    async getScenarioById(scenarioId) {
      const scenarios = await listScenarios();
      return scenarios.find((scenario) => scenario.id === scenarioId) ?? null;
    },
  };
};
