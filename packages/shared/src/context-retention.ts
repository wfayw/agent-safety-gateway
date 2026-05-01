import { PatentStateMachineDomain } from "./patent-state-machine.js";
import type {
  PatentProofHash,
  PatentProofTimestamp,
  StateMachineEntityId,
  StateMachineRunId,
} from "./patent-state-machine.js";

export const ContextRetentionDomainName =
  PatentStateMachineDomain.ContextRetention;

export type ContextRetentionDomainName = typeof ContextRetentionDomainName;

export type ToolCallCandidateId = StateMachineEntityId;

export type ActionImpactClassId = StateMachineEntityId;

export type RequiredContextObligationId = StateMachineEntityId;

export type ContextAnchorId = StateMachineEntityId;

export type PromptAssemblyManifestId = StateMachineEntityId;

export type PromptAssemblyManifestHash = PatentProofHash;

export type ContextRetentionEvidenceId = StateMachineEntityId;

export type ContextSufficiencyStateId = StateMachineEntityId;

export type RegroundingPlanId = StateMachineEntityId;

export type PermitDecisionId = StateMachineEntityId;

export type ContextAdequacyEvidenceId = StateMachineEntityId;

export type ContextRetentionRunId = StateMachineRunId;

export type ContextRetentionTimestamp = PatentProofTimestamp;

export const ContextRetentionDomain = {
  name: ContextRetentionDomainName,
  stateMachine: "context-sufficiency",
  obligation: "RequiredContextObligation",
  manifest: "PromptAssemblyManifest",
  evidence: "ContextRetentionEvidence",
  permitExit: "PermitDecision",
} as const;
