import client from './client';

export interface Follow {
  id: string;
  follower_id: string;
  dog_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  author_id: string;
  author_name: string | null;
  target_type: string;
  target_id: string;
  body: string;
  created_at: string;
}

export interface ReactionCounts {
  like: number;
  cute: number;
  woof: number;
  user_reaction: string | null;
}

export interface UserProfile {
  id: string;
  display_name: string;
  location_rough: string | null;
  created_at: string;
  dog_count: number;
  follower_count: number;
}

// --- Follows ---

export async function followDog(dogId: string): Promise<Follow> {
  const res = await client.post('/social/follows', { dog_id: dogId });
  return res.data;
}

export async function unfollowDog(dogId: string): Promise<void> {
  await client.delete(`/social/follows/${dogId}`);
}

export async function getMyFollows(): Promise<Follow[]> {
  const res = await client.get('/social/follows/mine');
  return res.data;
}

export async function getFollowerCount(dogId: string): Promise<{ count: number; is_following: boolean }> {
  const res = await client.get(`/social/dogs/${dogId}/followers/count`);
  return res.data;
}

// --- Comments ---

export async function createComment(targetType: string, targetId: string, body: string): Promise<Comment> {
  const res = await client.post('/social/comments', { target_type: targetType, target_id: targetId, body });
  return res.data;
}

export async function getComments(targetType: string, targetId: string): Promise<Comment[]> {
  const res = await client.get('/social/comments', { params: { target_type: targetType, target_id: targetId } });
  return res.data;
}

export async function deleteComment(commentId: string): Promise<void> {
  await client.delete(`/social/comments/${commentId}`);
}

// --- Reactions ---

export async function toggleReaction(targetType: string, targetId: string, kind: string): Promise<ReactionCounts> {
  const res = await client.post('/social/reactions', { target_type: targetType, target_id: targetId, kind });
  return res.data;
}

export async function getReactions(targetType: string, targetId: string): Promise<ReactionCounts> {
  const res = await client.get('/social/reactions', { params: { target_type: targetType, target_id: targetId } });
  return res.data;
}

// --- User Profiles ---

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const res = await client.get(`/social/users/${userId}/profile`);
  return res.data;
}
