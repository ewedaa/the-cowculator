import { useState, useEffect } from 'react';
import { getAnimalsWithPL } from '../db';
import { useSettings } from '../SettingsContext';
import db, { SEEDED_ANIMALS_COUNT, deleteAnimalAndRelatedRecords, loadSeededAnimalsSafely } from '../db';
import { generateAnimalPDF } from '../utils/AnimalPDFReport';
import './HerdView.css';

export default function HerdView({ addToast }) {
  const { settings, formatCurrency } = useSettings();
  const [animals, setAnimals] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(settings.defaultView || 'grid');
  const [search, setSearch] = useState('');
  const [filterPen, setFilterPen] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSpecies, setFilterSpecies] = useState('');
  const [sortBy, setSortBy] = useState('tag');
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editAnimal, setEditAnimal] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showRegroupModal, setShowRegroupModal] = useState(false);
  const [newPen, setNewPen] = useState('');

  useEffect(() => { loadAnimals(); }, []);

  useEffect(() => {
    let result = [...animals];
    if (search) result = result.filter(a => String(a.tag).includes(search) || (a.notes || '').toLowerCase().includes(search.toLowerCase()));
    if (filterPen) result = result.filter(a => a.pen_id === filterPen);
    if (filterSpecies) result = result.filter(a => a.species === filterSpecies);
    if (filterStatus === 'win') result = result.filter(a => a.unrealizedPL >= 0);
    if (filterStatus === 'lose') result = result.filter(a => a.unrealizedPL < 0);

    result.sort((a, b) => {
      if (sortBy === 'tag') return a.tag - b.tag;
      if (sortBy === 'profit') return b.unrealizedPL - a.unrealizedPL;
      if (sortBy === 'weight') return (b.currentWeight || 0) - (a.currentWeight || 0);
      if (sortBy === 'cost') return b.totalCost - a.totalCost;
      if (sortBy === 'days') return b.daysOnFarm - a.daysOnFarm;
      if (sortBy === 'gain') return (b.dailyGain || 0) - (a.dailyGain || 0);
      return 0;
    });

    setFiltered(result);
  }, [animals, search, filterPen, filterStatus, filterSpecies, sortBy]);

  async function loadAnimals() {
    setLoading(true);
    const data = await getAnimalsWithPL(settings.marketPricePerKg);
    setAnimals(data);
    setLoading(false);
  }

  const pens = [...new Set(animals.map(a => a.pen_id).filter(Boolean))].sort();
  const speciesUsed = [...new Set(animals.map(a => a.species).filter(Boolean))];

  async function handleAddAnimal(formData) {
    await db.animals.add({
      tag: parseInt(formData.tag),
      species: formData.species || settings.species[0],
      pen_id: formData.pen_id || '',
      status: 'active',
      lifecycle_stage: formData.lifecycle_stage || settings.lifecycleStages[0],
      purchase_price: parseFloat(formData.purchase_price) || 0,
      entry_weight: parseFloat(formData.entry_weight) || 0,
      entry_date: formData.entry_date || new Date().toISOString().split('T')[0],
      notes: formData.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    addToast('Animal added successfully');
    setShowAddModal(false);
    loadAnimals();
  }

  async function handleEditAnimal(formData) {
    const existing = await db.animals.where('tag').equals(parseInt(formData.tag)).first();
    if (!existing) return;
    await db.animals.update(existing.id, {
      species: formData.species,
      pen_id: formData.pen_id,
      lifecycle_stage: formData.lifecycle_stage,
      purchase_price: parseFloat(formData.purchase_price) || 0,
      entry_weight: parseFloat(formData.entry_weight) || 0,
      entry_date: formData.entry_date,
      notes: formData.notes || '',
      status: formData.status || 'active',
      updated_at: new Date().toISOString(),
    });
    addToast('Animal updated');
    setEditAnimal(null);
    setSelectedAnimal(null);
    loadAnimals();
  }

  async function handleDeleteAnimal(tag) {
    if (!confirm(`Delete animal #${tag} and all associated records?`)) return;
    const deleted = await deleteAnimalAndRelatedRecords(tag);
    if (deleted) {
      addToast(`Animal #${tag} deleted`);
      setSelectedAnimal(null);
      loadAnimals();
      return;
    }
    addToast(`Animal #${tag} was not found`, 'error');
  }

  async function handleBulkRegroup() {
    if (!newPen.trim()) {
      addToast('Please enter a pen ID', 'error');
      return;
    }
    setLoading(true);
    try {
      for (const id of selectedIds) {
        await db.animals.update(id, { pen_id: newPen.trim(), updated_at: new Date().toISOString() });
      }
      addToast(`✅ Regrouped ${selectedIds.length} buffalos to pen ${newPen}`);
      setSelectedIds([]);
      setShowRegroupModal(false);
      setNewPen('');
      loadAnimals();
    } catch (err) {
      addToast('Error regrouping: ' + err.message, 'error');
      setLoading(false);
    }
  }

  function toggleSelection(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  function toggleAllSelection() {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(a => a.id));
    }
  }

  return (
    <div className="herd-view animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Herd View</h1>
          <p>{animals.length} animals in the herd</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Animal</button>
      </div>

      {/* Filters */}
      <div className="glass-card filter-bar">
        <input className="input filter-search" placeholder="Search by tag # or notes..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input filter-select" value={filterPen} onChange={e => setFilterPen(e.target.value)}>
          <option value="">All Pens</option>
          {pens.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input filter-select" value={filterSpecies} onChange={e => setFilterSpecies(e.target.value)}>
          <option value="">All Species</option>
          {speciesUsed.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
        </select>
        <select className="input filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="win">✅ Winners</option>
          <option value="lose">❌ Losers</option>
        </select>
        <select className="input filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="tag">Sort: Tag #</option>
          <option value="profit">Sort: Profit</option>
          <option value="weight">Sort: Weight</option>
          <option value="cost">Sort: Cost</option>
          <option value="days">Sort: Days on Farm</option>
          <option value="gain">Sort: Daily Gain</option>
        </select>
        <div className="view-toggle">
          <button className={`btn btn-icon ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>⊞</button>
          <button className={`btn btn-icon ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>☰</button>
        </div>
      </div>

      {/* Results count & Bulk Actions */}
      <div className="results-bar flex justify-between items-center">
        <span className="text-secondary text-sm">Showing {filtered.length} of {animals.length} buffalos</span>
        {selectedIds.length > 0 && (
          <div className="bulk-actions flex gap-sm items-center">
            <span className="text-sm font-mono">{selectedIds.length} selected</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowRegroupModal(true)}>
              🔄 Regroup Selected
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>Clear</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="empty-state"><div className="empty-state-icon">⏳</div><h3>Loading herd...</h3></div>
      ) : filtered.length === 0 && animals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🐄</div>
          <h3>No animals in the herd</h3>
          <p>Add your first animal manually, import CSV data, or auto-load the {SEEDED_ANIMALS_COUNT} animals below.</p>
          <div className="flex gap-sm" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Animal</button>
            <button className="btn btn-ghost" onClick={async () => {
              await loadSeededAnimalsSafely();
              window.location.reload();
            }}>🐄 Load Sample ({SEEDED_ANIMALS_COUNT})</button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (

        <div className="animal-grid">
          {filtered.map(animal => (
            <div key={animal.id} className={`glass-card animal-card ${settings.showProfitColors ? animal.status_indicator : ''}`}
              onClick={() => setSelectedAnimal(animal)}>
              <div className="animal-card-header">
                <span className="animal-tag font-mono">#{animal.tag}</span>
                <span className={`badge badge-${animal.status_indicator}`}>
                  {animal.status_indicator === 'win' ? '▲ Win' : '▼ Lose'}
                </span>
              </div>
              <div className="animal-card-body">
                <div className="animal-stat"><span className="stat-label">Pen</span><span className="stat-value">{animal.pen_id || '—'}</span></div>
                <div className="animal-stat"><span className="stat-label">Weight</span><span className="stat-value font-mono">{animal.currentWeight?.toFixed(0) || '—'} kg</span></div>
                <div className="animal-stat"><span className="stat-label">Daily Gain</span><span className="stat-value font-mono">{animal.dailyGain?.toFixed(2) || '—'} kg/d</span></div>
                <div className="animal-stat"><span className="stat-label">Total Cost</span><span className="stat-value font-mono">{formatCurrency(animal.totalCost)}</span></div>
              </div>
              <div className="animal-card-footer">
                <span className="pl-value font-mono" style={{ color: animal.unrealizedPL >= 0 ? 'var(--win)' : 'var(--lose)' }}>
                  {animal.unrealizedPL >= 0 ? '+' : ''}{formatCurrency(animal.unrealizedPL)}
                </span>
                <span className="pl-label">Unrealized P/L</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card" style={{ maxWidth: '100%', overflowX: 'auto' }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th style={{width:40}}>
                    <input type="checkbox" checked={filtered.length > 0 && selectedIds.length === filtered.length} onChange={toggleAllSelection} />
                  </th>
                  <th>Tag</th><th>Species</th><th>Pen</th><th>Entry Date</th><th>Entry Wt</th>
                  <th>Current Wt</th><th>Daily Gain</th><th>Days</th><th>Purchase</th>
                  <th>Expenses</th><th>Total Cost</th><th>Est. Value</th><th>P/L</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} onClick={() => setSelectedAnimal(a)} style={{ cursor: 'pointer', background: selectedIds.includes(a.id) ? 'rgba(99, 102, 241, 0.1)' : '' }}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(a.id)} onChange={() => toggleSelection(a.id)} />
                    </td>
                    <td className="font-mono" style={{ fontWeight: 600 }}>#{a.tag}</td>
                    <td style={{ textTransform: 'capitalize' }}>{a.species}</td>
                    <td>{a.pen_id || '—'}</td>
                    <td>{a.entry_date || '—'}</td>
                    <td className="font-mono">{a.entry_weight?.toFixed(0)}</td>
                    <td className="font-mono">{a.currentWeight?.toFixed(0)}</td>
                    <td className="font-mono">{a.dailyGain?.toFixed(2)}</td>
                    <td className="font-mono">{a.daysOnFarm}</td>
                    <td className="font-mono">{formatCurrency(a.purchase_price)}</td>
                    <td className="font-mono">{formatCurrency(a.totalExpenses)}</td>
                    <td className="font-mono">{formatCurrency(a.totalCost)}</td>
                    <td className="font-mono">{formatCurrency(a.estimatedValue)}</td>
                    <td className="font-mono" style={{ color: a.unrealizedPL >= 0 ? 'var(--win)' : 'var(--lose)', fontWeight: 600 }}>
                      {a.unrealizedPL >= 0 ? '+' : ''}{formatCurrency(a.unrealizedPL)}
                    </td>
                    <td><span className={`badge badge-${a.status_indicator}`}>{a.status_indicator === 'win' ? 'Win' : 'Lose'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Animal Detail Modal */}
      {selectedAnimal && (
        <div className="modal-overlay" onClick={() => setSelectedAnimal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div className="flex items-center gap-md">
                <span style={{ fontSize: '1.5rem' }}>🐄</span>
                <div>
                  <h2 className="font-mono">#{selectedAnimal.tag}</h2>
                  <span className="text-secondary text-sm">{selectedAnimal.species} · {selectedAnimal.pen_id || 'No Pen'} · {selectedAnimal.lifecycle_stage}</span>
                </div>
                <span className={`badge badge-${selectedAnimal.status_indicator}`} style={{ marginLeft: 8 }}>
                  {selectedAnimal.status_indicator === 'win' ? '▲ Profitable' : '▼ At Loss'}
                </span>
              </div>
              <div className="flex gap-sm">
                <button className="btn btn-sm btn-ghost" onClick={async () => {
                  try {
                    await generateAnimalPDF(selectedAnimal, settings);
                    addToast(`📊 PDF report for #${selectedAnimal.tag} downloaded`);
                  } catch (err) { addToast('Error: ' + err.message, 'error'); }
                }}>📊 PDF Report</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setEditAnimal(selectedAnimal)}>✏️ Edit</button>
                <button className="btn btn-sm btn-lose" onClick={() => handleDeleteAnimal(selectedAnimal.tag)}>🗑️</button>
                <button className="btn btn-icon btn-ghost" onClick={() => setSelectedAnimal(null)}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Purchase Price</span><span className="detail-value font-mono">{selectedAnimal.purchase_price?.toLocaleString()} {settings.currency}</span></div>
                <div className="detail-item"><span className="detail-label">Entry Weight</span><span className="detail-value font-mono">{selectedAnimal.entry_weight} kg</span></div>
                <div className="detail-item"><span className="detail-label">Current Weight</span><span className="detail-value font-mono">{selectedAnimal.currentWeight?.toFixed(0)} kg</span></div>
                <div className="detail-item"><span className="detail-label">Weight Gained</span><span className="detail-value font-mono" style={{ color: 'var(--win)' }}>+{selectedAnimal.weightGain?.toFixed(0)} kg</span></div>
                <div className="detail-item"><span className="detail-label">Days on Farm</span><span className="detail-value font-mono">{selectedAnimal.daysOnFarm} days</span></div>
                <div className="detail-item"><span className="detail-label">Daily Gain</span><span className="detail-value font-mono">{selectedAnimal.dailyGain?.toFixed(2)} kg/day</span></div>
              </div>

              <h4 style={{ margin: '20px 0 12px' }}>Cost Breakdown</h4>
              <div className="cost-breakdown">
                <div className="cost-bar"><span>Feed</span><span className="font-mono">{selectedAnimal.totalFeed?.toLocaleString()} {settings.currency}</span></div>
                <div className="cost-bar"><span>Vaccines</span><span className="font-mono">{selectedAnimal.totalVaccines?.toLocaleString()} {settings.currency}</span></div>
                <div className="cost-bar"><span>Medicine</span><span className="font-mono">{selectedAnimal.totalMedicine?.toLocaleString()} {settings.currency}</span></div>
                <div className="cost-bar"><span>Admin</span><span className="font-mono">{selectedAnimal.totalAdmin?.toLocaleString()} {settings.currency}</span></div>
                <div className="cost-bar"><span>Other</span><span className="font-mono">{selectedAnimal.totalOther?.toLocaleString()} {settings.currency}</span></div>
                <div className="cost-bar cost-bar-total">
                  <span>Total Cost</span>
                  <span className="font-mono" style={{ fontWeight: 700 }}>{selectedAnimal.totalCost?.toLocaleString()} {settings.currency}</span>
                </div>
              </div>

              {selectedAnimal.totalRevenue > 0 && (
                <div className="cost-bar" style={{ marginTop: 8, background: 'var(--win-bg)', borderLeft: '3px solid var(--win)' }}>
                  <span>Total Revenue</span>
                  <span className="font-mono" style={{ color: 'var(--win)', fontWeight: 700 }}>+{selectedAnimal.totalRevenue?.toLocaleString()} {settings.currency}</span>
                </div>
              )}

              <div className="pl-summary" style={{ background: selectedAnimal.unrealizedPL >= 0 ? 'var(--win-bg)' : 'var(--lose-bg)', borderColor: selectedAnimal.unrealizedPL >= 0 ? 'var(--win-border)' : 'var(--lose-border)' }}>
                <div>
                  <span className="text-sm text-secondary">Est. Market Value</span>
                  <span className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedAnimal.estimatedValue?.toLocaleString()} {settings.currency}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="text-sm text-secondary">Unrealized P/L</span>
                  <span className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: selectedAnimal.unrealizedPL >= 0 ? 'var(--win)' : 'var(--lose)' }}>
                    {selectedAnimal.unrealizedPL >= 0 ? '+' : ''}{selectedAnimal.unrealizedPL?.toLocaleString()} {settings.currency}
                  </span>
                </div>
              </div>

              {selectedAnimal.notes && (
                <div style={{ marginTop: 16, padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="text-xs text-secondary" style={{ display: 'block', marginBottom: 4 }}>NOTES</span>
                  {selectedAnimal.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Animal Modal */}
      {showAddModal && <AnimalFormModal mode="add" onClose={() => setShowAddModal(false)} onSubmit={handleAddAnimal} settings={settings} existingPens={pens} />}
      {editAnimal && <AnimalFormModal mode="edit" initial={editAnimal} onClose={() => setEditAnimal(null)} onSubmit={handleEditAnimal} settings={settings} existingPens={pens} />}
      {/* Regroup Modal */}
      {showRegroupModal && (
        <div className="modal-overlay" onClick={() => setShowRegroupModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔄 Regroup {selectedIds.length} Buffalos</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowRegroupModal(false)}>✕</button>
            </div>
            <div className="modal-body form-grid">
              <div className="form-group">
                <label>Target Pen ID</label>
                <input 
                  autoFocus
                  type="text" 
                  className="input" 
                  value={newPen} 
                  onChange={e => setNewPen(e.target.value)} 
                  placeholder="e.g. 10B"
                  onKeyDown={e => { if (e.key === 'Enter') handleBulkRegroup(); }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowRegroupModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleBulkRegroup}>Regroup Now</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function AnimalFormModal({ mode, initial, onClose, onSubmit, settings }) {
  const [form, setForm] = useState({
    tag: initial?.tag || '', species: initial?.species || settings.species[0] || 'heifer',
    pen_id: initial?.pen_id || '', lifecycle_stage: initial?.lifecycle_stage || settings.lifecycleStages[0] || 'heifer',
    purchase_price: initial?.purchase_price || '', entry_weight: initial?.entry_weight || '',
    entry_date: initial?.entry_date || new Date().toISOString().split('T')[0],
    notes: initial?.notes || '', status: initial?.status || 'active',
  });
  const [pens, setPens] = useState([]);

  useEffect(() => {
    async function loadPens() {
      const dbPens = await db.pens.toArray();
      const animals = await db.animals.toArray();
      const inUsePens = [...new Set(animals.map(a => a.pen_id).filter(Boolean))];
      
      const allPenIds = new Set([
        ...dbPens.map(p => p.id),
        ...inUsePens
      ]);
      
      setPens([...allPenIds].sort());
    }
    loadPens();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.tag) return;
    onSubmit(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'edit' ? `✏️ Edit #${form.tag}` : '➕ Add New Animal'}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Tag Number *</label>
                <input className="input" type="number" value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} required disabled={mode === 'edit'} autoFocus={mode === 'add'} />
              </div>
              <div className="form-group">
                <label>Species</label>
                <select className="input" value={form.species} onChange={e => setForm({ ...form, species: e.target.value })}>
                  {settings.species.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Pen</label>
                <select 
                  className="input" 
                  value={form.pen_id} 
                  onChange={e => setForm({ ...form, pen_id: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {pens.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Stage</label>
                <select className="input" value={form.lifecycle_stage} onChange={e => setForm({ ...form, lifecycle_stage: e.target.value })}>
                  {settings.lifecycleStages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Purchase Price ({settings.currency})</label>
                <input className="input" type="number" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Entry Weight (kg)</label>
                <input className="input" type="number" value={form.entry_weight} onChange={e => setForm({ ...form, entry_weight: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Entry Date</label>
                <input className="input" type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} />
              </div>
              {mode === 'edit' && (
                <div className="form-group">
                  <label>Status</label>
                  <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="sold">Sold</option>
                    <option value="deceased">Deceased</option>
                  </select>
                </div>
              )}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <input className="input" placeholder="Optional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{mode === 'edit' ? 'Save Changes' : 'Add Animal'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
