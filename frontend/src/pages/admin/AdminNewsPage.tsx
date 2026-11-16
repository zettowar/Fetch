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
import ErrorState from '../../components/ui/ErrorState';
import Input from '../../components/ui/Input';
import PageHeader from '../../components/ui/PageHeader';
import TimeAgo from '../../components/TimeAgo';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { CHECK, FIELD, ROWS } from './adminStyles';
import { apiErrorMessage } from '../../utils/apiError';

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

  const { data: posts = [], isLoading, isError, refetch } = useQuery({
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
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "That didn't go through. Try again.")),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateNewsPost(editId!, formData()),
    onSuccess: () => {
      toast.success('Updated');
      invalidate();
      resetForm();
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "That didn't go through. Try again.")),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => updateNewsPost(id, { is_published: true }),
    onSuccess: () => {
      toast.success('Published');
      invalidate();
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "That didn't go through. Try again.")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNewsPost,
    onSuccess: () => {
      toast.success('Deleted');
      invalidate();
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "That didn't go through. Try again.")),
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
      <PageHeader
        title="News"
        className="mb-5"
        action={
          <Button
            size="sm"
            variant={showForm ? 'secondary' : 'primary'}
            onClick={() => { const opening = !showForm; resetForm(); setShowForm(opening); }}
          >
            {showForm ? 'Cancel' : 'New post'}
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-4 flex flex-col gap-3">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            label="Tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Product, Milestone, Partnerships…"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-news-body" className="field-label">Body</label>
            <textarea
              id="admin-news-body"
              className={`${FIELD} resize-y`}
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
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-navy dark:text-biscuit">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className={CHECK}
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
      ) : isError ? (
        <ErrorState message="Couldn't load news posts." onRetry={() => refetch()} />
      ) : posts.length === 0 ? (
        <EmptyState className="py-6" title="No news posts yet" />
      ) : (
        <Card padding="none" className={ROWS}>
          {posts.map((post) => (
            <div key={post.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-extrabold text-navy dark:text-biscuit">{post.title}</p>
                    <Badge variant="brand">{post.tag}</Badge>
                    {!post.is_published && <Badge variant="neutral">Draft</Badge>}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2 whitespace-pre-wrap">
                    {post.body}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {post.is_published && post.published_at
                      ? <>Published <TimeAgo value={post.published_at} className="font-mono" /></>
                      : <>Created <TimeAgo value={post.created_at} className="font-mono" /></>}
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
