import { useState, useEffect } from 'react';
import { useSettings } from '../SettingsContext';
import db from '../db';
import './ExpenseTracker.css';

export default function ExpenseTracker({ addToast }) {
  const { settings, formatCurrencyFull } = useSettings();
  const [animals, setAnimals] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({ animal_tag: '', category: settings.expenseCategories[0]?.key || 'feed', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkTags, setBulkTags] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showRevenueForm, setShowRevenueForm] = useState(false);
  const [revForm, setRevForm] = useState({ animal_tag: '', type: settings.revenueTypes[0]?.key || 'milk', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [revenues, setRevenues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [animalList, expenseList, revenueList] = await Promise.all([
      db.animals.toArray(),
      db.expenses.orderBy('id').reverse().limit(100).toArray(),
      db.revenueRecords.orderBy('id').reverse().limit(50).toArray(),
    ]);
    setAnimals(animalList);
    setExpenses(expenseList);
    setRevenues(revenueList);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return;

    if (bulkMode) {
      const tags = bulkTags.split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t));
      if (tags.length === 0) return;
      for (const tag of tags) {
        await db.expenses.add({
          animal_tag: tag, date: form.date, category: form.category,
          amount, description: form.description || `Bulk ${form.category}`,
        });
      }
      addToast(`Expense logged for ${tags.length} animals`);
    } else {
      const tag = parseInt(form.animal_tag);
      if (isNaN(tag)) return;
      await db.expenses.add({
        animal_tag: tag, date: form.date, category: form.category,
        amount, description: form.description || '',
      });
      addToast('Expense logged successfully');
    }

    setForm({ ...form, amount: '', description: '' });
    loadData();
  }

  async function handleRevenueSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(revForm.amount);
    const tag = parseInt(revForm.animal_tag);
    if (!amount || isNaN(tag)) return;

    await db.revenueRecords.add({
      animal_tag: tag, date: revForm.date, type: revForm.type,
      amount, description: revForm.description || '',
    });
    addToast('Revenue recorded');
    setRevForm({ ...revForm, amount: '', description: '' });
    loadData();
  }

  async function deleteExpense(id) {
    await db.expenses.delete(id);
    addToast('Expense deleted');
    loadData();
  }

  async function deleteRevenue(id) {
    await db.revenueRecords.delete(id);
    addToast('Revenue deleted');
    loadData();
  }

  const filteredExpenses = filterCat ? expenses.filter(e => e.category === filterCat) : expenses;
  const getCategoryInfo = (cat) => settings.expenseCategories.find(c => c.key === cat) || { key: cat, label: cat, icon: '📦', color: '#64748b' };
  const getRevenueInfo = (type) => settings.revenueTypes.find(t => t.key === type) || { key: type, label: type, icon: '📦' };

  return (
    <div className="expense-tracker animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Expense & Revenue Tracker</h1>
          <p>Log costs and revenue per animal — less than 3 clicks</p>
        </div>
        <div className="flex gap-sm">
          <button className={`btn ${!showRevenueForm ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowRevenueForm(false)}>💰 Expenses</button>
          <button className={`btn ${showRevenueForm ? 'btn-win' : 'btn-ghost'}`}
            onClick={() => setShowRevenueForm(true)}>📈 Revenue</button>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Entry Form */}
        {!showRevenueForm ? (
          <div className="glass-card expense-form-card">
            <div className="card-header" style={{ border: 'none', padding: '20px 20px 0' }}>
              <h3>💰 Quick Expense Entry</h3>
              <button className={`btn btn-sm ${bulkMode ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setBulkMode(!bulkMode)}>
                {bulkMode ? '✓ Bulk Mode' : 'Bulk Mode'}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="expense-form">
              {/* Category Tabs */}
              <div className="category-tabs">
                {settings.expenseCategories.map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    className={`category-tab ${form.category === cat.key ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, category: cat.key })}
                    style={form.category === cat.key ? { borderColor: cat.color, background: `${cat.color}15` } : {}}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>

              {/* Animal Selector */}
              {bulkMode ? (
                <div className="form-group">
                  <label>Animal Tags (comma-separated)</label>
                  <input className="input" placeholder="4000, 4001, 4002..."
                    value={bulkTags} onChange={e => setBulkTags(e.target.value)} />
                  <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 4 }}
                    onClick={() => setBulkTags(animals.map(a => a.tag).join(', '))}>
                    Select All ({animals.length})
                  </button>
                </div>
              ) : (
                <div className="form-group">
                  <label>Animal</label>
                  <select className="input" value={form.animal_tag} onChange={e => setForm({ ...form, animal_tag: e.target.value })} required>
                    <option value="">Select animal...</option>
                    {animals.map(a => <option key={a.id} value={a.tag}>#{a.tag} — {a.pen_id || 'No Pen'}</option>)}
                  </select>
                </div>
              )}

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Amount ({settings.currency})</label>
                  <input className="input" type="number" step="0.01" placeholder="0.00" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Date</label>
                  <input className="input" type="date" value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <input className="input" placeholder="Brief note..." value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
                💰 Log Expense
              </button>
            </form>
          </div>
        ) : (
          /* Revenue Form */
          <div className="glass-card expense-form-card">
            <div className="card-header" style={{ border: 'none', padding: '20px 20px 0' }}>
              <h3>📈 Log Revenue</h3>
            </div>

            <form onSubmit={handleRevenueSubmit} className="expense-form">
              <div className="category-tabs">
                {settings.revenueTypes.map(rt => (
                  <button key={rt.key} type="button"
                    className={`category-tab ${revForm.type === rt.key ? 'active' : ''}`}
                    onClick={() => setRevForm({ ...revForm, type: rt.key })}>
                    <span>{rt.icon}</span>
                    <span>{rt.label}</span>
                  </button>
                ))}
              </div>

              <div className="form-group">
                <label>Animal</label>
                <select className="input" value={revForm.animal_tag} onChange={e => setRevForm({ ...revForm, animal_tag: e.target.value })} required>
                  <option value="">Select animal...</option>
                  {animals.map(a => <option key={a.id} value={a.tag}>#{a.tag} — {a.pen_id || 'No Pen'}</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Amount ({settings.currency})</label>
                  <input className="input" type="number" step="0.01" placeholder="0.00" value={revForm.amount}
                    onChange={e => setRevForm({ ...revForm, amount: e.target.value })} required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Date</label>
                  <input className="input" type="date" value={revForm.date}
                    onChange={e => setRevForm({ ...revForm, date: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <input className="input" placeholder="Brief note..." value={revForm.description}
                  onChange={e => setRevForm({ ...revForm, description: e.target.value })} />
              </div>

              <button type="submit" className="btn btn-win" style={{ width: '100%', marginTop: 8, background: 'var(--win)', color: 'white', border: 'none' }}>
                📈 Log Revenue
              </button>
            </form>
          </div>
        )}

        {/* History Panel */}
        <div className="glass-card">
          <div className="card-header">
            <h3>{showRevenueForm ? 'Recent Revenue' : 'Recent Expenses'}</h3>
            {!showRevenueForm && (
              <select className="input" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ maxWidth: 140 }}>
                <option value="">All</option>
                {settings.expenseCategories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            )}
          </div>
          <div className="table-container" style={{ border: 'none', maxHeight: 500, overflow: 'auto' }}>
            {!showRevenueForm ? (
              <table>
                <thead>
                  <tr><th>Tag</th><th>Category</th><th>Amount</th><th>Date</th><th>Note</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No expenses logged yet</td></tr>
                  ) : filteredExpenses.map(exp => {
                    const catInfo = getCategoryInfo(exp.category);
                    return (
                      <tr key={exp.id}>
                        <td className="font-mono" style={{ fontWeight: 600 }}>#{exp.animal_tag}</td>
                        <td>
                          <span className="badge badge-info" style={{ background: `${catInfo.color}20`, color: catInfo.color, border: 'none' }}>
                            {catInfo.icon} {catInfo.label}
                          </span>
                        </td>
                        <td className="font-mono">{exp.amount?.toLocaleString()} {settings.currency}</td>
                        <td className="text-sm text-secondary">{exp.date ? new Date(exp.date).toLocaleDateString() : '—'}</td>
                        <td className="text-sm text-secondary truncate" style={{ maxWidth: 120 }}>{exp.description || '—'}</td>
                        <td><button className="btn btn-icon btn-ghost btn-sm" onClick={() => deleteExpense(exp.id)} title="Delete">🗑️</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr><th>Tag</th><th>Type</th><th>Amount</th><th>Date</th><th>Note</th><th></th></tr>
                </thead>
                <tbody>
                  {revenues.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No revenue recorded yet</td></tr>
                  ) : revenues.map(rev => {
                    const revInfo = getRevenueInfo(rev.type);
                    return (
                      <tr key={rev.id}>
                        <td className="font-mono" style={{ fontWeight: 600 }}>#{rev.animal_tag}</td>
                        <td><span className="badge badge-win">{revInfo.icon} {revInfo.label}</span></td>
                        <td className="font-mono" style={{ color: 'var(--win)' }}>+{rev.amount?.toLocaleString()} {settings.currency}</td>
                        <td className="text-sm text-secondary">{rev.date ? new Date(rev.date).toLocaleDateString() : '—'}</td>
                        <td className="text-sm text-secondary truncate" style={{ maxWidth: 120 }}>{rev.description || '—'}</td>
                        <td><button className="btn btn-icon btn-ghost btn-sm" onClick={() => deleteRevenue(rev.id)} title="Delete">🗑️</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
