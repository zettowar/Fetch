import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createFAQ, updateFAQ, deleteFAQ, type FAQEntry } from '../../api/admin';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import { ListSkeleton } from '../../components/ui/Skeleton';

// Fetchpawz FAQ via support endpoint (public, but admin can manage)
import client from '../../api/client';
const getFAQ = async (): Promise<FAQEntry[]> => (await client.get('/support/faq')).data;

export default function AdminFAQPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('general');

  const { data: faqs = [], isLoading } = useQuery({
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
    onError: () => toast.error('Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateFAQ(editId!, { question, answer, category }),
    onSuccess: () => {
      toast.success('FAQ updated');
      queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
      resetForm();
    },
    onError: () => toast.error('Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFAQ,
    onSuccess: () => {
      toast.success('FAQ deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
    },
    onError: () => toast.error('Failed'),
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">FAQ Management</h1>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? 'Cancel' : 'Add Entry'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-4 flex flex-col gap-3">
          <Input label="Question" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Answer</label>
            <textarea
              className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2.5 text-base outline-none focus:border-brand-500 resize-none"
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
      ) : faqs.length === 0 ? (
        <EmptyState className="py-6" title="No FAQ entries" />
      ) : (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {faqs.map((faq) => (
            <div key={faq.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{faq.question}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{faq.answer}</p>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{faq.category}</span>
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
