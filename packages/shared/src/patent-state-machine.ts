export const PatentStateMachineDomain = {
  ForbiddenSideEffect: "forbidden-side-effect",
  ContextRetention: "context-retention",
} as const;

export type PatentStateMachineDomain =
  (typeof PatentStateMachineDomain)[keyof typeof PatentStateMachineDomain];

export type PatentProofId = string;

export type PatentProofHash = string;

export type PatentProofTimestamp = string;

export type StateMachineRunId = PatentProofId;

export type StateMachineEntityId = PatentProofId;

export type EvidenceArtifactId = PatentProofId;

export type EvidenceArtifactHash = PatentProofHash;

export type EvidenceVersion = PatentProofHash;

export const EvidenceHashAlgorithm = {
  Sha256: "sha256",
  Sha512: "sha512",
} as const;

export type EvidenceHashAlgorithm =
  (typeof EvidenceHashAlgorithm)[keyof typeof EvidenceHashAlgorithm];

export type EvidenceDigest = {
  algorithm: EvidenceHashAlgorithm;
  value: EvidenceArtifactHash;
};

export type PatentStateMachineEnvelope = {
  id: StateMachineEntityId;
  domain: PatentStateMachineDomain;
  createdAt: PatentProofTimestamp;
  updatedAt?: PatentProofTimestamp;
};
