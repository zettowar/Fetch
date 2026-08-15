import client from './client';

export type PostKind = 'community' | 'sponsor' | 'rescue_spotlight';

export interface Post {
  id: string;
  author_id: string;
  author_name: string | null;
  kind: PostKind;
  title: string;
  body: string;
  tags: string[] | null;
  pinned: boolean;
  created_at: string;
}

export interface PostListParams {
  kind?: PostKind;
  tag?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export async function listPosts(params: PostListParams = {}): Promise<Post[]> {
  // Drop empties so the request URL stays clean and the query key is stable.
  const query = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  );
  return (await client.get('/posts', { params: query })).data;
}

export async function getPost(id: string): Promise<Post> {
  return (await client.get(`/posts/${id}`)).data;
}

export async function createPost(payload: {
  title: string;
  body: string;
  kind?: PostKind;
  tags?: string[];
}): Promise<Post> {
  return (await client.post('/posts', payload)).data;
}

export async function deletePost(id: string): Promise<void> {
  await client.delete(`/posts/${id}`);
}
