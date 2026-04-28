import { Tag } from 'antd';
import type { ReactNode } from 'react';

export type DecisionStatus = 'allow' | 'block' | 'require_approval' | 'sandbox' | 'rewrite';

export type RiskStatus = 'low' | 'medium' | 'high' | 'prohibited';

type StatusConfig<TStatus extends string> = Record<
  TStatus,
  {
    color: string;
    label: string;
  }
>;

const decisionStatusConfig = {
  allow: {
    color: 'success',
    label: '允许',
  },
  block: {
    color: 'error',
    label: '阻断',
  },
  require_approval: {
    color: 'warning',
    label: '审批',
  },
  sandbox: {
    color: 'warning',
    label: '沙箱',
  },
  rewrite: {
    color: 'processing',
    label: '改写',
  },
} satisfies StatusConfig<DecisionStatus>;

const riskStatusConfig = {
  low: {
    color: 'success',
    label: '低风险',
  },
  medium: {
    color: 'warning',
    label: '中风险',
  },
  high: {
    color: 'error',
    label: '高风险',
  },
  prohibited: {
    color: 'red',
    label: '禁止风险',
  },
} satisfies StatusConfig<RiskStatus>;

type StatusTagProps<TStatus extends string> = {
  status: TStatus;
};

function renderStatusTag<TStatus extends string>(
  config: StatusConfig<TStatus>,
  status: TStatus,
): ReactNode {
  const statusConfig = config[status];

  return <Tag color={statusConfig.color}>{statusConfig.label}</Tag>;
}

export function DecisionStatusTag({ status }: StatusTagProps<DecisionStatus>) {
  return renderStatusTag(decisionStatusConfig, status);
}

export function RiskStatusTag({ status }: StatusTagProps<RiskStatus>) {
  return renderStatusTag(riskStatusConfig, status);
}

export function renderDecisionStatusTag(status: DecisionStatus): ReactNode {
  return renderStatusTag(decisionStatusConfig, status);
}

export function renderRiskStatusTag(status: RiskStatus): ReactNode {
  return renderStatusTag(riskStatusConfig, status);
}
