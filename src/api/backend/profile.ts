import type { UserProfile, RewardFulfillment } from '../../types';
import { backendApi } from './client';
import {
  AuthUserEnvelopeSchema,
  RedeemedRewardsEnvelopeSchema,
  RedeemRewardEnvelopeSchema,
  toRewardFulfillment,
  toUserProfile,
} from './schemas';

export async function patchProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
  const res = await backendApi('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch),
    schema: AuthUserEnvelopeSchema,
  });
  return toUserProfile(res.user);
}

export async function fetchRedeemedRewards(): Promise<string[]> {
  const res = await backendApi('/api/profile/redeemed', {
    schema: RedeemedRewardsEnvelopeSchema,
  });
  return res.rewardIds;
}

export async function redeemRewardRemote(
  rewardId: string,
  pointsCost: number
): Promise<{ user: UserProfile; rewardIds: string[]; fulfillment: RewardFulfillment }> {
  const res = await backendApi('/api/profile/redeem', {
    method: 'POST',
    body: JSON.stringify({ rewardId, pointsCost }),
    schema: RedeemRewardEnvelopeSchema,
  });
  return {
    user: toUserProfile(res.user),
    rewardIds: res.rewardIds,
    fulfillment: toRewardFulfillment(res.fulfillment),
  };
}

export async function syncRedeemedRewards(rewardIds: string[]): Promise<string[]> {
  const res = await backendApi('/api/profile/redeemed', {
    method: 'POST',
    body: JSON.stringify({ rewardIds }),
    schema: RedeemedRewardsEnvelopeSchema,
  });
  return res.rewardIds;
}
