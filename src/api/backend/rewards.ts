import type { RewardFulfillment } from '../../types';
import { backendApi } from './client';

export async function fetchRewardFulfillments(status?: string): Promise<RewardFulfillment[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await backendApi<{ fulfillments: RewardFulfillment[] }>(`/api/rewards/fulfillments${query}`);
  return res.fulfillments;
}
