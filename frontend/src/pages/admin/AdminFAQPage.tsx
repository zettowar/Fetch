import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createFAQ, updateFAQ, deleteFAQ, type FAQEntry } from '../../api/admin';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Input from '../../components/ui/Input';
import PageHeader from '../../components/ui/PageHeader';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { FIELD, ROWS } from './adminStyles';

// Fetchpawz FAQ via support endpoint (public, but admin can manage)
import client from '../../api/client';
import { apiErrorMessage } from '../../utils/apiError';
const getFAQ = async (): Promise<FAQEntry[]> => (await client.get('/support/faq')).data;

export default function AdminFAQPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('general');

  const { data: faqs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-faq'],
    queryFn: getFAQ,
  });

  const createMutation = useMutation({
    mutationFn: () => createFAQ({ question, answer, category }),
    onSuccess: () => {
      toast.success('FAQ created');
      queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
      resetForm();
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "That didn't go through. Try again.")),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateFAQ(editId!, { question, answer, category }),
    onSuccess: () => {
      toast.success('FAQ updated');
      queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
      resetForm();
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "That didn't go through. Try again.")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFAQ,
    onSuccess: () => {
      toast.success('FAQ deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "That didn't go through. Try again.")),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setQuestion('');
    setAnswer('');
    setCategory('general');
  };

  const startEdit = (faq: FAQEntry) => {
    setEditId(faq.id);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setCategory(faq.category);
    setShowForm(true);
  };

  return (
    <div>
      <PageHeader
        title="FAQ management"
        className="mb-5"
        action={
          <Button size="sm" variant={showForm ? 'secondary' : 'primary'} onClick={() => { resetForm(); setShowForm(!showForm); }}>
            {showForm ? 'Cancel' : 'Add entry'}
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-4 flex flex-col gap-3">
          <Input label="Question" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-faq-answer" className="field-label">Answer</label>
            <textarea
              id="admin-faq-answer"
              className={`${FIELD} resize-none`}
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </div>
          <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
          <Button
            onClick={() => editId ? updateMutation.mutate() : createMutation.mutate()}
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={!question.trim() || !answer.trim()}
          >
            {editId ? 'Update' : 'Create'}
          </Button>
        </Card>
      )}

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Couldn't load FAQ entries." onRetry={() => refetch()} />
      ) : faqs.length === 0 ? (
        <EmptyState className="py-6" title="No FAQ entries" />
      ) : (
        <Card padding="none" className={ROWS}>
          {faqs.map((faq) => (
            <div key={faq.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-sm text-navy dark:text-biscuit">{faq.question}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{faq.answer}</p>
                  <span className="mt-1.5 inline-block font-mono text-2xs text-gray-500 dark:text-gray-400">{faq.category}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(faq)}>Edit</Button>
                  <Button size="sm" variant="ghost" loading={deleteMutation.isPending && deleteMutation.variables === faq.id} onClick={() => { if (confirm('Delete this FAQ?')) deleteMutation.mutate(faq.id); }}>Del</Button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
