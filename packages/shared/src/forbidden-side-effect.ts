import { PatentStateMachineDomain } from "./patent-state-machine.js";
import type {
  PatentProofHash,
  PatentProofTimestamp,
  StateMachineEntityId,
  StateMachineRunId,
} from "./patent-state-machine.js";

export const ForbiddenSideEffectDomainName =
  PatentStateMachineDomain.ForbiddenSideEffect;

export type ForbiddenSideEffectDomainName =
  typeof ForbiddenSideEffectDomainName;

export type ForbiddenEffectObligationId = StateMachineEntityId;

export type EvidencePlanId = StateMachineEntityId;

export type DeniedCapabilityEvidenceId = StateMachineEntityId;

export type SideEffectDeltaEvidenceId = StateMachineEntityId;

export type EvidenceCoverageMapId = StateMachineEntityId;

export type ExecutorSafetyEvidenceStateId = StateMachineEntityId;

export type ExecutorDriftFingerprintHash = PatentProofHash;

export type PermitBindingId = StateMachineEntityId;

export type PermitDeniedEvidenceId = StateMachineEntityId;

export type ForbiddenSideEffectRunId = StateMachineRunId;

export type ForbiddenSideEffectTimestamp = PatentProofTimestamp;

export const ForbiddenSideEffectDomain = {
  name: ForbiddenSideEffectDomainName,
  stateMachine: "executor-safety-evidence",
  obligation: "ForbiddenEffectObligation",
  evidence: ["DeniedCapabilityEvidence", "SideEffectDeltaEvidence"],
  permitExit: "PermitBinding",
} as const;
