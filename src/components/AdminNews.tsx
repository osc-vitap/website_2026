import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, RefreshCw, X, Save, AlertTriangle } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://events.oscvitap.com';

interface NewsItem {
  id: number;
  title: string;
  category: string;
  date: string;
  excerpt: string;
  link: string | null;
}

const emptyForm = {
  title: '',
  category: '',
  date: '',
  excerpt: '',
  link: '',
};

export default function AdminNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchNews = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_BASE_URL}/api/admin/news`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch news');
      const data = await response.json();
      setNews(data.news || []);
    } catch (err) {
      console.error(err);
      setError('Unable to load news.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.title.trim() || !form.category.trim() || !form.date.trim() || !form.excerpt.trim()) {
      setFormError('Title, Category, Date, and Excerpt are required.');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/news`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category.trim(),
          date: form.date.trim(),
          excerpt: form.excerpt.trim(),
          link: form.link.trim() || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to create news');
      
      setShowCreateModal(false);
      setForm(emptyForm);
      await fetchNews();
    } catch (err) {
      setFormError('Unable to create news.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: NewsItem) => {
    setSelectedId(item.id);
    setForm({
      title: item.title,
      category: item.category,
      date: item.date,
      excerpt: item.excerpt,
      link: item.link || '',
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setFormError('');

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/news/${selectedId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category.trim(),
          date: form.date.trim(),
          excerpt: form.excerpt.trim(),
          link: form.link.trim() || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update news');
      
      setShowEditModal(false);
      setForm(emptyForm);
      setSelectedId(null);
      await fetchNews();
    } catch (err) {
      setFormError('Unable to update news.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setDeleting(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/news/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete news');
      setConfirmDelete(null);
      await fetchNews();
    } catch (err) {
      setError('Unable to delete news.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">News & Announcements</h2>
          <p className="text-sm text-gray-400 mt-1">Manage public news and announcements.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchNews}
            disabled={loading}
            className="p-2 rounded-lg bg-dark-600/50 text-gray-400 hover:text-white hover:bg-dark-500 transition-colors disabled:opacity-50"
            title="Refresh list"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setForm(emptyForm);
              setFormError('');
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add News
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-dark-600/50 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600/50">
              {news.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No news items found.
                  </td>
                </tr>
              ) : (
                news.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{item.title}</div>
                      <div className="text-gray-500 text-xs mt-1 max-w-md truncate">{item.excerpt}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-dark-600/50 text-gray-300">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400">{item.date}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-2 text-gray-400 hover:text-white bg-dark-600/50 hover:bg-dark-500 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {confirmDelete === item.id ? (
                          <div className="flex items-center gap-2 bg-red-500/10 p-1 rounded-lg border border-red-500/20">
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-2 py-1 text-xs text-gray-400 hover:text-white"
                              disabled={deleting}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                              disabled={deleting}
                            >
                              Confirm
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(item.id)}
                            className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-dark-900 border border-dark-600 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-dark-600 bg-dark-800/50">
              <h3 className="text-lg font-bold text-white">
                {showCreateModal ? 'Create News' : 'Edit News'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar">
              {formError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-200">
                  {formError}
                </div>
              )}

              <form 
                id="newsForm" 
                onSubmit={showCreateModal ? handleCreate : handleEdit} 
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Title <span className="text-brand-primary">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-brand-primary transition-colors"
                    placeholder="e.g. Core Committee Recruitment 2026"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Category <span className="text-brand-primary">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-brand-primary transition-colors"
                      placeholder="e.g. [Recruitment]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Date <span className="text-brand-primary">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-brand-primary transition-colors"
                      placeholder="e.g. July 15, 2026"
                    />
                  </div>
                </div>

                <div data-color-mode="dark">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Excerpt <span className="text-brand-primary">*</span>
                  </label>
                  <MDEditor
                    value={form.excerpt}
                    onChange={(val) => setForm({ ...form, excerpt: val || '' })}
                    preview="edit"
                    height={200}
                    className="w-full bg-dark-800 border border-dark-600 rounded-lg focus-within:border-brand-primary transition-colors custom-scrollbar"
                    textareaProps={{
                      placeholder: 'Short description (Supports Markdown)...'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Link (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.link}
                    onChange={(e) => setForm({ ...form, link: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-brand-primary transition-colors"
                    placeholder="e.g. /news/recruitment-2026"
                  />
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-dark-600 bg-dark-800/50 flex justify-end gap-3 mt-auto">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="newsForm"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                {saving ? (
                  <span className="animate-pulse">Saving...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
