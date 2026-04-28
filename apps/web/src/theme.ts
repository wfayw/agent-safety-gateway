import type { ThemeConfig } from 'antd';

export const safetyStatusColors = {
  allow: '#15803d',
  block: '#b91c1c',
  requireApproval: '#c2410c',
  sandbox: '#d97706',
  rewrite: '#1d4ed8',
  riskLow: '#15803d',
  riskMedium: '#c2410c',
  riskHigh: '#b91c1c',
  riskProhibited: '#7f1d1d',
} as const;

export const safetyGatewayTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1d4ed8',
    colorInfo: safetyStatusColors.rewrite,
    colorSuccess: safetyStatusColors.allow,
    colorWarning: safetyStatusColors.requireApproval,
    colorError: safetyStatusColors.block,
    colorBgLayout: '#f5f7fb',
    colorText: '#0f172a',
    borderRadius: 8,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#f5f7fb',
    },
    Card: {
      borderRadiusLG: 12,
    },
  },
};
