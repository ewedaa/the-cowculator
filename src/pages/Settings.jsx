import { useState, useEffect } from 'react';
import { useSettings } from '../SettingsContext';
import db, { dedupeAnimalsByTag } from '../db';
import Papa from 'papaparse';
import './Settings.css';

const ICON_OPTIONS = ['🌾','💉','💊','📋','👷','🚛','📦','🔧','⚡','🏠','🧪','🩺','💧','🛢️','🧴','🪣','🔩','📐'];
const COLOR_OPTIONS = ['#10b981','#3b82f6','#f59e0b','#6366f1','#8b5cf6','#ec4899','#64748b','#ef4444','#14b8a6','#f97316','#84cc16','#06b6d4'];

export default function Settings({ addToast }) {
  const {
    settings, updateSettings, resetSettings,
    addExpenseCategory, removeExpenseCategory,
    addRevenueType, removeRevenueType,
    addSpecies, removeSpecies,
    addLifecycleStage, removeLifecycleStage,
    addNutritionItem, removeNutritionItem, updateNutritionItem,
    DEFAULT_SETTINGS,
  } = useSettings();

  const [activeSection, setActiveSection] = useState('farm');
  const [newCatForm, setNewCatForm] = useState({ key: '', label: '', icon: '📦', color: '#6366f1' });
  const [newRevForm, setNewRevForm] = useState({ key: '', label: '', icon: '📦' });
  const [newNutForm, setNewNutForm] = useState({ key: '', label: '', price: '', icon: '🌾' });
  const [newSpecies, setNewSpecies] = useState('');
  const [newStage, setNewStage] = useState('');
  const [newPen, setNewPen] = useState({ id: '', name: '', type: 'fattening', capacity: 50 });
  const [confirmReset, setConfirmReset] = useState(false);

  const sections = [
    { key: 'farm', icon: '🏠', label: 'Farm Info' },
    { key: 'financial', icon: '💰', label: 'Financial' },
    { key: 'categories', icon: '📂', label: 'Categories' },
    { key: 'nutrition', icon: '🌾', label: 'Nutrition & Feed' },
    { key: 'animals', icon: '🐄', label: 'Animal Types' },
    { key: 'pens', icon: '🏗️', label: 'Pen Management' },
    { key: 'display', icon: '🎨', label: 'Display' },
    { key: 'alerts', icon: '🔔', label: 'Alerts' },
    { key: 'data', icon: '💾', label: 'Data Management' },
  ];

  async function handleExportBackup() {
    const tables = ['animals', 'expenses', 'weightRecords', 'vaccineRecords', 'medicineRecords', 'dailyFeedCosts', 'revenueRecords', 'pens'];
    const backup = { version: 1, date: new Date().toISOString(), settings };
    for (const table of tables) {
      backup[table] = await db[table].toArray();
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cowculator-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    updateSettings({ lastBackupDate: new Date().toISOString() });
    addToast('Backup exported successfully');
  }

  async function handleImportBackup(file) {
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup.version) { addToast('Invalid backup file', 'error'); return; }

      const tables = ['animals', 'expenses', 'weightRecords', 'vaccineRecords', 'medicineRecords', 'dailyFeedCosts', 'revenueRecords', 'pens'];
      for (const table of tables) {
        if (backup[table]) {
          await db[table].clear();
          await db[table].bulkAdd(backup[table]);
        }
      }
      await dedupeAnimalsByTag();
      if (backup.settings) {
        updateSettings(backup.settings);
      }
      addToast('Backup restored successfully');
    } catch (err) {
      addToast('Failed to restore backup: ' + err.message, 'error');
    }
  }

  async function handleClearAllData() {
    await Promise.all([
      db.animals.clear(), db.expenses.clear(), db.weightRecords.clear(),
      db.vaccineRecords.clear(), db.medicineRecords.clear(), db.dailyFeedCosts.clear(),
      db.revenueRecords.clear(), db.pens.clear(), db.importLogs.clear(),
    ]);
    addToast('All data cleared');
  }

  function handleAddCategory(e) {
    e.preventDefault();
    if (!newCatForm.key || !newCatForm.label) return;
    const key = newCatForm.key.toLowerCase().replace(/\s+/g, '_');
    if (settings.expenseCategories.find(c => c.key === key)) {
      addToast('Category key already exists', 'error');
      return;
    }
    addExpenseCategory({ ...newCatForm, key });
    setNewCatForm({ key: '', label: '', icon: '📦', color: '#6366f1' });
    addToast('Category added');
  }

  function handleAddRevType(e) {
    e.preventDefault();
    if (!newRevForm.key || !newRevForm.label) return;
    const key = newRevForm.key.toLowerCase().replace(/\s+/g, '_');
    if (settings.revenueTypes.find(t => t.key === key)) {
      addToast('Revenue type already exists', 'error');
      return;
    }
    addRevenueType({ ...newRevForm, key });
    setNewRevForm({ key: '', label: '', icon: '📦' });
    addToast('Revenue type added');
  }

  function handleAddNutrition(e) {
    e.preventDefault();
    if (!newNutForm.key || !newNutForm.label || !newNutForm.price) return;
    const key = newNutForm.key.toLowerCase().replace(/\s+/g, '_');
    if ((settings.nutritionItems || []).find(n => n.key === key)) {
      addToast('Nutrition item key already exists', 'error');
      return;
    }
    addNutritionItem({ ...newNutForm, key, price: parseFloat(newNutForm.price) });
    setNewNutForm({ key: '', label: '', price: '', icon: '🌾' });
    addToast('Nutrition item added');
  }

  async function handleAddPen(e) {
    e.preventDefault();
    if (!newPen.id) return;
    await db.pens.put({ id: newPen.id, name: newPen.name || `Pen ${newPen.id}`, type: newPen.type, capacity: parseInt(newPen.capacity) || 50 });
    setNewPen({ id: '', name: '', type: 'fattening', capacity: 50 });
    addToast('Pen added');
  }

  return (
    <div className="settings-page animate-fade-in">
      <div className="page-header">
        <h1>⚙️ Settings</h1>
        <p>Customize Cowculator to fit your farm's needs</p>
      </div>

      <div className="settings-layout">
        {/* Section Nav */}
        <div className="glass-card settings-nav">
          {sections.map(s => (
            <button
              key={s.key}
              className={`settings-nav-item ${activeSection === s.key ? 'active' : ''}`}
              onClick={() => setActiveSection(s.key)}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Section Content */}
        <div className="settings-content">

          {/* ─── FARM INFO ─── */}
          {activeSection === 'farm' && (
            <div className="glass-card settings-section animate-fade-in">
              <div className="section-header">
                <h2>🏠 Farm Information</h2>
                <p>Basic farm details used across the application</p>
              </div>
              <div className="settings-form">
                <div className="form-group">
                  <label>Farm Name</label>
                  <input className="input" value={settings.farmName}
                    onChange={e => updateSettings({ farmName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Farm Logo Emoji</label>
                  <div className="emoji-picker">
                    {['🐄','🐃','🐂','🏠','🌾','🚜','🤠','🐮'].map(e => (
                      <button key={e} type="button"
                        className={`emoji-btn ${settings.farmLogo === e ? 'active' : ''}`}
                        onClick={() => updateSettings({ farmLogo: e })}
                      >{e}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── FINANCIAL ─── */}
          {activeSection === 'financial' && (
            <div className="glass-card settings-section animate-fade-in">
              <div className="section-header">
                <h2>💰 Financial Settings</h2>
                <p>Configure currency and market pricing for P/L calculations</p>
              </div>
              <div className="settings-form">
                <div className="form-group">
                  <label>Currency Symbol</label>
                  <select className="input" value={settings.currency}
                    onChange={e => updateSettings({ currency: e.target.value })}>
                    <option value="EGP">EGP (Egyptian Pound)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="SAR">SAR (Saudi Riyal)</option>
                    <option value="AED">AED (UAE Dirham)</option>
                    <option value="GBP">GBP (British Pound)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Market Price per Kg (Live Cattle)</label>
                  <div className="input-with-unit">
                    <input className="input" type="number" step="0.5"
                      value={settings.marketPricePerKg}
                      onChange={e => updateSettings({ marketPricePerKg: parseFloat(e.target.value) || 0 })} />
                    <span className="input-unit">{settings.currency}/kg</span>
                  </div>
                  <span className="form-hint">Used to calculate estimated market value of each animal</span>
                </div>
                <div className="form-group">
                  <label>Number Format</label>
                  <select className="input" value={settings.numberFormat}
                    onChange={e => updateSettings({ numberFormat: e.target.value })}>
                    <option value="en">English (1,234.56)</option>
                    <option value="ar-EG">Arabic (١٬٢٣٤٫٥٦)</option>
                    <option value="de">German (1.234,56)</option>
                    <option value="fr">French (1 234,56)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ─── EXPENSE CATEGORIES ─── */}
          {activeSection === 'categories' && (
            <div className="glass-card settings-section animate-fade-in">
              <div className="section-header">
                <h2>📂 Expense & Revenue Categories</h2>
                <p>Add, remove, or customize cost and revenue types</p>
              </div>

              <h3 style={{ margin: '20px 0 12px' }}>Expense Categories</h3>
              <div className="tag-list">
                {settings.expenseCategories.map(cat => (
                  <div key={cat.key} className="tag-item" style={{ borderLeft: `3px solid ${cat.color}` }}>
                    <span>{cat.icon}</span>
                    <span className="tag-label">{cat.label}</span>
                    <span className="tag-key text-xs text-secondary">{cat.key}</span>
                    <button className="tag-remove" onClick={() => removeExpenseCategory(cat.key)} title="Remove">✕</button>
                  </div>
                ))}
              </div>
              <form className="add-tag-form" onSubmit={handleAddCategory}>
                <input className="input" placeholder="Key (e.g. water)" value={newCatForm.key}
                  onChange={e => setNewCatForm({ ...newCatForm, key: e.target.value })} required />
                <input className="input" placeholder="Label (e.g. Water Supply)" value={newCatForm.label}
                  onChange={e => setNewCatForm({ ...newCatForm, label: e.target.value })} required />
                <div className="mini-picker">
                  {ICON_OPTIONS.slice(0, 6).map(ic => (
                    <button key={ic} type="button" className={`emoji-btn-sm ${newCatForm.icon === ic ? 'active' : ''}`}
                      onClick={() => setNewCatForm({ ...newCatForm, icon: ic })}>{ic}</button>
                  ))}
                </div>
                <div className="mini-picker">
                  {COLOR_OPTIONS.slice(0, 6).map(c => (
                    <button key={c} type="button" className={`color-btn ${newCatForm.color === c ? 'active' : ''}`}
                      style={{ background: c }} onClick={() => setNewCatForm({ ...newCatForm, color: c })} />
                  ))}
                </div>
                <button type="submit" className="btn btn-primary btn-sm">+ Add</button>
              </form>

              <h3 style={{ margin: '24px 0 12px' }}>Revenue Types</h3>
              <div className="tag-list">
                {settings.revenueTypes.map(rt => (
                  <div key={rt.key} className="tag-item">
                    <span>{rt.icon}</span>
                    <span className="tag-label">{rt.label}</span>
                    <button className="tag-remove" onClick={() => removeRevenueType(rt.key)}>✕</button>
                  </div>
                ))}
              </div>
              <form className="add-tag-form" onSubmit={handleAddRevType}>
                <input className="input" placeholder="Key" value={newRevForm.key}
                  onChange={e => setNewRevForm({ ...newRevForm, key: e.target.value })} required />
                <input className="input" placeholder="Label" value={newRevForm.label}
                  onChange={e => setNewRevForm({ ...newRevForm, label: e.target.value })} required />
                <button type="submit" className="btn btn-primary btn-sm">+ Add</button>
              </form>
            </div>
          )}

          {/* ─── NUTRITION & FEED ─── */}
          {activeSection === 'nutrition' && (
            <div className="glass-card settings-section animate-fade-in">
              <div className="section-header">
                <h2>🌾 Nutrition & Feed Inventory</h2>
                <p>Manage feed items and their current market prices per kg to calculate IOFC accurately</p>
              </div>

              <div className="tag-list" style={{ marginTop: '20px' }}>
                {(settings.nutritionItems || []).map(nut => (
                  <div key={nut.key} className="tag-item" style={{ borderLeft: '3px solid #10b981' }}>
                    <span>{nut.icon}</span>
                    <span className="tag-label">{nut.label}</span>
                    <span className="badge badge-info">{nut.price} {settings.currency}/kg</span>
                    <button className="tag-remove" onClick={() => removeNutritionItem(nut.key)}>✕</button>
                  </div>
                ))}
                {(settings.nutritionItems || []).length === 0 && <p className="text-secondary text-sm">No nutrition items configured.</p>}
              </div>
              
              <form className="add-tag-form" onSubmit={handleAddNutrition} style={{ marginTop: '16px' }}>
                <input className="input" placeholder="Key (e.g. silage)" value={newNutForm.key}
                  onChange={e => setNewNutForm({ ...newNutForm, key: e.target.value })} required />
                <input className="input" placeholder="Label (e.g. Corn Silage)" value={newNutForm.label}
                  onChange={e => setNewNutForm({ ...newNutForm, label: e.target.value })} required />
                <input className="input" type="number" step="0.01" placeholder={`Price/kg (${settings.currency})`} value={newNutForm.price}
                  onChange={e => setNewNutForm({ ...newNutForm, price: e.target.value })} required />
                <div className="mini-picker">
                  {['🌾','🌽','🌱','🛢️','🧂','🌿','🥕'].map(ic => (
                    <button key={ic} type="button" className={`emoji-btn-sm ${newNutForm.icon === ic ? 'active' : ''}`}
                      onClick={() => setNewNutForm({ ...newNutForm, icon: ic })}>{ic}</button>
                  ))}
                </div>
                <button type="submit" className="btn btn-primary btn-sm">+ Add Item</button>
              </form>
            </div>
          )}

          {/* ─── ANIMAL TYPES ─── */}
          {activeSection === 'animals' && (
            <div className="glass-card settings-section animate-fade-in">
              <div className="section-header">
                <h2>🐄 Animal Types & Stages</h2>
                <p>Define species and lifecycle stages available in your forms</p>
              </div>

              <h3 style={{ margin: '16px 0 12px' }}>Species</h3>
              <div className="tag-list">
                {settings.species.map(sp => (
                  <div key={sp} className="tag-item">
                    <span className="tag-label" style={{ textTransform: 'capitalize' }}>{sp}</span>
                    <button className="tag-remove" onClick={() => removeSpecies(sp)}>✕</button>
                  </div>
                ))}
              </div>
              <form className="add-tag-form" onSubmit={e => { e.preventDefault(); if (newSpecies.trim()) { addSpecies(newSpecies.trim().toLowerCase()); setNewSpecies(''); addToast('Species added'); } }}>
                <input className="input" placeholder="New species..." value={newSpecies} onChange={e => setNewSpecies(e.target.value)} />
                <button type="submit" className="btn btn-primary btn-sm">+ Add</button>
              </form>

              <h3 style={{ margin: '24px 0 12px' }}>Lifecycle Stages</h3>
              <div className="tag-list">
                {settings.lifecycleStages.map(st => (
                  <div key={st} className="tag-item">
                    <span className="tag-label" style={{ textTransform: 'capitalize' }}>{st}</span>
                    <button className="tag-remove" onClick={() => removeLifecycleStage(st)}>✕</button>
                  </div>
                ))}
              </div>
              <form className="add-tag-form" onSubmit={e => { e.preventDefault(); if (newStage.trim()) { addLifecycleStage(newStage.trim().toLowerCase()); setNewStage(''); addToast('Stage added'); } }}>
                <input className="input" placeholder="New stage..." value={newStage} onChange={e => setNewStage(e.target.value)} />
                <button type="submit" className="btn btn-primary btn-sm">+ Add</button>
              </form>
            </div>
          )}

          {/* ─── PEN MANAGEMENT ─── */}
          {activeSection === 'pens' && (
            <PenManagement addToast={addToast} newPen={newPen} setNewPen={setNewPen} handleAddPen={handleAddPen} />
          )}

          {/* ─── DISPLAY ─── */}
          {activeSection === 'display' && (
            <div className="glass-card settings-section animate-fade-in">
              <div className="section-header">
                <h2>🎨 Display Preferences</h2>
                <p>Customize how data is presented</p>
              </div>
              <div className="settings-form">
                <div className="form-group">
                  <label>Default Herd View</label>
                  <select className="input" value={settings.defaultView}
                    onChange={e => updateSettings({ defaultView: e.target.value })}>
                    <option value="grid">Grid (Cards)</option>
                    <option value="table">Table (List)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Items Per Page</label>
                  <select className="input" value={settings.itemsPerPage}
                    onChange={e => updateSettings({ itemsPerPage: parseInt(e.target.value) })}>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                  </select>
                </div>
                <div className="toggle-group">
                  <label>Show Profit/Loss Colors</label>
                  <button className={`toggle-btn ${settings.showProfitColors ? 'on' : ''}`}
                    onClick={() => updateSettings({ showProfitColors: !settings.showProfitColors })}>
                    <span className="toggle-knob" />
                  </button>
                </div>
                <div className="toggle-group">
                  <label>Animations Enabled</label>
                  <button className={`toggle-btn ${settings.animationsEnabled ? 'on' : ''}`}
                    onClick={() => updateSettings({ animationsEnabled: !settings.animationsEnabled })}>
                    <span className="toggle-knob" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── ALERTS ─── */}
          {activeSection === 'alerts' && (
            <div className="glass-card settings-section animate-fade-in">
              <div className="section-header">
                <h2>🔔 Alert Thresholds</h2>
                <p>Set performance thresholds for alerts</p>
              </div>
              <div className="settings-form">
                <div className="form-group">
                  <label>Low Weight Gain Alert (kg/day)</label>
                  <input className="input" type="number" step="0.1"
                    value={settings.lowWeightGainThreshold}
                    onChange={e => updateSettings({ lowWeightGainThreshold: parseFloat(e.target.value) || 0 })} />
                  <span className="form-hint">Animals below this daily gain will be flagged</span>
                </div>
                <div className="form-group">
                  <label>Target Daily Gain (kg/day)</label>
                  <input className="input" type="number" step="0.1"
                    value={settings.targetDailyGain}
                    onChange={e => updateSettings({ targetDailyGain: parseFloat(e.target.value) || 0 })} />
                  <span className="form-hint">Ideal daily weight gain for your herd</span>
                </div>
                <div className="form-group">
                  <label>High Cost Alert ({settings.currency})</label>
                  <input className="input" type="number"
                    value={settings.highCostThreshold}
                    onChange={e => updateSettings({ highCostThreshold: parseFloat(e.target.value) || 0 })} />
                  <span className="form-hint">Animals above this total cost will be flagged</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── DATA MANAGEMENT ─── */}
          {activeSection === 'data' && (
            <div className="glass-card settings-section animate-fade-in">
              <div className="section-header">
                <h2>💾 Data Management</h2>
                <p>Backup, restore, and manage your farm data</p>
              </div>
              <div className="data-actions">
                <div className="data-action-card">
                  <div className="da-icon">📤</div>
                  <div className="da-content">
                    <h4>Export Backup</h4>
                    <p>Download all farm data as JSON</p>
                    {settings.lastBackupDate && (
                      <span className="text-xs text-secondary">Last backup: {new Date(settings.lastBackupDate).toLocaleString()}</span>
                    )}
                  </div>
                  <button className="btn btn-primary" onClick={handleExportBackup}>Export</button>
                </div>

                <div className="data-action-card">
                  <div className="da-icon">📥</div>
                  <div className="da-content">
                    <h4>Restore Backup</h4>
                    <p>Import previously exported backup file</p>
                  </div>
                  <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                    Import
                    <input type="file" accept=".json" style={{ display: 'none' }}
                      onChange={e => e.target.files[0] && handleImportBackup(e.target.files[0])} />
                  </label>
                </div>

                <div className="data-action-card danger">
                  <div className="da-icon">🗑️</div>
                  <div className="da-content">
                    <h4>Clear All Data</h4>
                    <p>Permanently remove all animal and financial records</p>
                  </div>
                  {!confirmReset ? (
                    <button className="btn btn-lose" onClick={() => setConfirmReset(true)}>Clear</button>
                  ) : (
                    <div className="flex gap-sm">
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button>
                      <button className="btn btn-lose btn-sm" onClick={() => { handleClearAllData(); setConfirmReset(false); }}>Confirm Delete</button>
                    </div>
                  )}
                </div>

                <div className="data-action-card danger">
                  <div className="da-icon">🔄</div>
                  <div className="da-content">
                    <h4>Reset Settings</h4>
                    <p>Restore all settings to factory defaults</p>
                  </div>
                  <button className="btn btn-ghost" onClick={() => { resetSettings(); addToast('Settings reset to defaults'); }}>Reset</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PenManagement({ addToast, newPen, setNewPen, handleAddPen }) {
  const [pens, setPens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function syncPens() {
      // Fetch existing pens
      let existingPens = await db.pens.toArray();
      const existingPenIds = new Set(existingPens.map(p => p.id));
      
      // Auto-sync pens from herd
      const animals = await db.animals.toArray();
      const herdPens = [...new Set(animals.map(a => a.pen_id).filter(Boolean))];
      
      let addedCount = 0;
      for (const hp of herdPens) {
        if (!existingPenIds.has(hp)) {
          await db.pens.put({ id: hp, name: `Pen ${hp}`, type: 'dairy', capacity: 50 });
          addedCount++;
        }
      }
      
      if (addedCount > 0) {
        existingPens = await db.pens.toArray();
      }
      
      setPens(existingPens);
      setLoading(false);
    }
    syncPens();
  }, []);

  async function refreshPens() {
    const p = await db.pens.toArray();
    setPens(p);
  }

  async function deletePen(id) {
    await db.pens.delete(id);
    await refreshPens();
    addToast('Pen removed');
  }

  return (
    <div className="glass-card settings-section animate-fade-in">
      <div className="section-header">
        <h2>🏗️ Pen Management</h2>
        <p>Add and manage barn pens/sections</p>
      </div>

      <div className="tag-list">
        {pens.map(pen => (
          <div key={pen.id} className="tag-item" style={{ borderLeft: '3px solid var(--accent)' }}>
            <span style={{ fontWeight: 600 }}>{pen.id}</span>
            <span className="tag-label">{pen.name}</span>
            <span className="badge badge-info">{pen.type}</span>
            <span className="text-xs text-secondary">Cap: {pen.capacity}</span>
            <button className="tag-remove" onClick={() => deletePen(pen.id)}>✕</button>
          </div>
        ))}
        {pens.length === 0 && <p className="text-secondary text-sm">No pens configured. Add one below.</p>}
      </div>

      <form className="add-tag-form" onSubmit={async (e) => { await handleAddPen(e); await refreshPens(); }}>
        <input className="input" placeholder="Pen ID (e.g. 1A)" value={newPen.id}
          onChange={e => setNewPen({ ...newPen, id: e.target.value })} required />
        <input className="input" placeholder="Name (e.g. Barn A)" value={newPen.name}
          onChange={e => setNewPen({ ...newPen, name: e.target.value })} />
        <select className="input" value={newPen.type} onChange={e => setNewPen({ ...newPen, type: e.target.value })} style={{ maxWidth: 130 }}>
          <option value="fattening">Fattening</option>
          <option value="dairy">Dairy</option>
          <option value="calves">Calves</option>
          <option value="quarantine">Quarantine</option>
          <option value="breeding">Breeding</option>
        </select>
        <input className="input" type="number" placeholder="Capacity" value={newPen.capacity}
          onChange={e => setNewPen({ ...newPen, capacity: e.target.value })} style={{ maxWidth: 80 }} />
        <button type="submit" className="btn btn-primary btn-sm">+ Add Pen</button>
      </form>
    </div>
  );
}
