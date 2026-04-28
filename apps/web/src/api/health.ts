import { apiClient, type ApiClient } from './client';

export type HealthResponse = {
  status: 'ok';
};

export const getHealth = (client: ApiClient = apiClient) => {
  return client.get<HealthResponse>('/health');
};
