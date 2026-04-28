import { Alert, Empty, Flex, Spin, Typography } from 'antd';
import type { ReactNode } from 'react';

const { Paragraph, Text, Title } = Typography;

type SectionHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
};

export function SectionHeader({ title, description, extra }: SectionHeaderProps) {
  return (
    <Flex align="flex-start" gap="middle" justify="space-between" wrap="wrap">
      <Flex vertical gap={4}>
        <Title level={3}>{title}</Title>
        {description ? <Paragraph type="secondary">{description}</Paragraph> : null}
      </Flex>
      {extra ? <div>{extra}</div> : null}
    </Flex>
  );
}

type LoadingStateProps = {
  title: ReactNode;
  description?: ReactNode;
};

export function LoadingState({ title, description }: LoadingStateProps) {
  return (
    <Flex align="center" className="ui-state-panel" gap="middle" justify="center" vertical>
      <Spin size="large" />
      <Flex align="center" gap={4} vertical>
        <Text strong>{title}</Text>
        {description ? <Text type="secondary">{description}</Text> : null}
      </Flex>
    </Flex>
  );
}

type ErrorStateProps = {
  title: ReactNode;
  description: ReactNode;
};

export function ErrorState({ title, description }: ErrorStateProps) {
  return <Alert showIcon type="error" title={title} description={description} />;
}

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <Empty
      className="ui-state-panel"
      description={
        <Flex gap={4} vertical>
          <Text strong>{title}</Text>
          {description ? <Text type="secondary">{description}</Text> : null}
        </Flex>
      }
    />
  );
}
