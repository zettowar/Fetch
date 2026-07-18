import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getAdminNews,
  createNewsPost,
  updateNewsPost,
  deleteNewsPost,
  type NewsPost,
} from '../../api/admin';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import TimeAgo from '../../components/TimeAgo';
import { ListSkeleton } from '../../components/ui/Skeleton';

/** Marketing-site news articles. Published posts show on /news immediately;
 *  drafts stay here until published. */
export default function AdminNewsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('Update');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['admin-news'],
    queryFn: getAdminNews,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-news'] });
    queryClient.invalidateQueries({ queryKey: ['public-news'] });
  };

  const formData = () => ({
    title,
    tag: tag.trim() || 'Update',
    body,
    link_url: linkUrl.trim() || null,
    link_label: linkLabel.trim() || null,
    is_published: isPublished,
  });

  const createMutation = useMutation({
    mutationFn: () => createNewsPost(formData()),
    onSuccess: (post) => {
      toast.success(post.is_published ? 'Published' : 'Draft saved');
      invalidate();
      resetForm();
    },
    onError: () => toast.error('Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateNewsPost(editId!, formData()),
    onSuccess: () => {
      toast.success('Updated');
      invalidate();
      resetForm();
    },
    onError: () => toast.error('Failed'),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => updateNewsPost(id, { is_published: true }),
    onSuccess: () => {
      toast.success('Published');
      invalidate();
    },
    onError: () => toast.error('Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNewsPost,
    onSuccess: () => {
      toast.success('Deleted');
      invalidate();
    },
    onError: () => toast.error('Failed'),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setTitle('');
    setTag('Update');
    setBody('');
    setLinkUrl('');
    setLinkLabel('');
    setIsPublished(true);
  };

  const startEdit = (post: NewsPost) => {
    setEditId(post.id);
    setTitle(post.title);
    setTag(post.tag);
    setBody(post.body);
    setLinkUrl(post.link_url ?? '');
    setLinkLabel(post.link_label ?? '');
    setIsPublished(post.is_published);
    setShowForm(true);
    window.scrollTo({ top: 0 });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">News</h1>
        <Button size="sm" onClick={() => { const opening = !showForm; resetForm(); setShowForm(opening); }}>
          {showForm ? 'Cancel' : 'New Post'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-4 flex flex-col gap-3">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            label="Tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Product, Milestone, Partnerships…"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Body</label>
            <textarea
              className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2.5 text-base outline-none focus:border-brand-500 resize-y"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Link URL (optional)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="/signup-rescue or https://…"
            />
            <Input
              label="Link label"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Apply as a rescue"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-700"
            />
            Published (visible on the public News page)
          </label>
          <Button
            onClick={() => (editId ? updateMutation.mutate() : createMutation.mutate())}
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={!title.trim() || !body.trim()}
          >
            {editId ? 'Update' : isPublished ? 'Publish' : 'Save draft'}
          </Button>
        </Card>
      )}

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : posts.length === 0 ? (
        <EmptyState className="py-6" title="No news posts yet" />
      ) : (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {posts.map((post) => (
            <div key={post.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{post.title}</p>
                    <Badge variant="brand">{post.tag}</Badge>
                    {!post.is_published && <Badge variant="neutral">Draft</Badge>}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2 whitespace-pre-wrap">
                    {post.body}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {post.is_published && post.published_at
                      ? <>Published <TimeAgo value={post.published_at} /></>
                      : <>Created <TimeAgo value={post.created_at} /></>}
                    {post.link_label && <> · links to “{post.link_label}”</>}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!post.is_published && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={publishMutation.isPending && publishMutation.variables === post.id}
                      onClick={() => publishMutation.mutate(post.id)}
                    >
                      Publish
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => startEdit(post)}>Edit</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={deleteMutation.isPending && deleteMutation.variables === post.id}
                    onClick={() => { if (confirm('Delete this post?')) deleteMutation.mutate(post.id); }}
                  >
                    Del
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
