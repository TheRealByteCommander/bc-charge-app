import type { UserProfile } from '../../types';
import { backendApi } from './client';

export async function patchProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
  const res = await backendApi<{ user: UserProfile }>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.user;
}

export async function fetchRedeemedRewards(): Promise<string[]> {
  const res = await backendApi<{ rewardIds: string[] }>('/api/profile/redeemed');
  return res.rewardIds;
}

export async function redeemRewardRemote(
  rewardId: string,
  pointsCost: number
): Promise<{ user: UserProfile; rewardIds: string[] }> {
  return backendApi('/api/profile/redeem', {
    method: 'POST',
    body: JSON.stringify({ rewardId, pointsCost }),
  });
}

export async function syncRedeemedRewards(rewardIds: string[]): Promise<string[]> {
  const res = await backendApi<{ rewardIds: string[] }>('/api/profile/redeemed', {
    method: 'POST',
    body: JSON.stringify({ rewardIds }),
  });
  return res.rewardIds;
}
