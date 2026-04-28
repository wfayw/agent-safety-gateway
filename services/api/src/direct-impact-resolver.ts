import {
  CriticalityLevel,
  ResourceType,
  RollbackCapability,
  SensitivityLevel,
  ToolType,
  type ActionTuple,
  type AffectedResource,
  type OperationType,
  type RollbackCapability as RollbackCapabilityValue,
} from "@agent-safety-gateway/shared";

import type { ResourceRepository } from "./catalog-repository.js";

export const DirectResourceResolutionStatus = {
  Matched: "matched",
  Unresolved: "unresolved",
} as const;

export type DirectResourceResolutionStatus =
  (typeof DirectResourceResolutionStatus)[keyof typeof DirectResourceResolutionStatus];

export type RollbackMetadata = {
  capability: RollbackCapabilityValue;
  reversible: boolean;
};

export type DirectResourceImpact = AffectedResource & {
  operation: OperationType;
  resolutionStatus: DirectResourceResolutionStatus;
  rollback: RollbackMetadata;
};

export type DirectImpactResolver = {
  resolveDirectResources: (
    actionTuple: ActionTuple,
  ) => Promise<DirectResourceImpact[]>;
};

const reversibleRollbackCapabilities = new Set<RollbackCapabilityValue>([
  RollbackCapability.Automatic,
  RollbackCapability.Manual,
]);

const expectedResourceTypeByToolType: Record<ActionTuple["toolType"], AffectedResource["type"]> = {
  [ToolType.Sql]: ResourceType.DatabaseTable,
  [ToolType.CiCd]: ResourceType.Service,
  [ToolType.Config]: ResourceType.ConfigKey,
};

const normalizeLookupValue = (value: string) =>
  value.trim().toLowerCase().replace(/[`"\[\]]/g, "");

const getTargetAliases = (actionTuple: ActionTuple) => {
  const target = normalizeLookupValue(actionTuple.target);
  const aliases = new Set<string>([target]);
  const firstSeparator = target.indexOf(".");

  if (firstSeparator >= 0) {
    aliases.add(target.slice(firstSeparator + 1));
  }

  return aliases;
};

const isResourceMatch = (
  resource: AffectedResource,
  actionTuple: ActionTuple,
) => {
  if (resource.environment !== actionTuple.environment) {
    return false;
  }

  const expectedType = expectedResourceTypeByToolType[actionTuple.toolType];

  if (resource.type !== expectedType) {
    return false;
  }

  return getTargetAliases(actionTuple).has(normalizeLookupValue(resource.name));
};

const toRollbackMetadata = (
  capability: RollbackCapabilityValue,
): RollbackMetadata => ({
  capability,
  reversible: reversibleRollbackCapabilities.has(capability),
});

const toDirectResourceImpact = (
  resource: AffectedResource,
  operation: OperationType,
  resolutionStatus: DirectResourceResolutionStatus,
): DirectResourceImpact => ({
  ...resource,
  operation,
  resolutionStatus,
  rollback: toRollbackMetadata(resource.rollbackCapability),
});

const createUnresolvedResource = (
  actionTuple: ActionTuple,
): AffectedResource => ({
  id: `unresolved-${actionTuple.environment}-${actionTuple.toolType}-${normalizeLookupValue(actionTuple.target).replace(/[^a-z0-9]+/g, "-")}`,
  name: actionTuple.target,
  type: expectedResourceTypeByToolType[actionTuple.toolType],
  system: "unresolved",
  environment: actionTuple.environment,
  sensitivityLevel: SensitivityLevel.Internal,
  criticalityLevel: CriticalityLevel.Medium,
  owner: "unknown",
  rollbackCapability: RollbackCapability.Unknown,
});

export const createDirectImpactResolver = (
  resourceRepository: ResourceRepository,
): DirectImpactResolver => ({
  async resolveDirectResources(actionTuple) {
    const resources = await resourceRepository.listResources();
    const matchedResources = resources.filter((resource) =>
      isResourceMatch(resource, actionTuple),
    );

    if (matchedResources.length === 0) {
      return [
        toDirectResourceImpact(
          createUnresolvedResource(actionTuple),
          actionTuple.operation,
          DirectResourceResolutionStatus.Unresolved,
        ),
      ];
    }

    return matchedResources.map((resource) =>
      toDirectResourceImpact(
        resource,
        actionTuple.operation,
        DirectResourceResolutionStatus.Matched,
      ),
    );
  },
});
