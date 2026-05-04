import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../SettingsContext';
import db from '../db';
import './ManualEntry.css';

const today = () => new Date().toISOString().split('T')[0];

// ─── blank row factories ───────────────────────────────────────────
const blankAnimal    = () => ({ tag: '', pen_id: '', entry_date: '2026-03-01', purchase_price: '', entry_weight: '', price_per_kg_entry: '', target_sale_date: '', fattening_days: '63', species: 'heifer', lifecycle_stage: 'fattening', notes: '' });
const blankWeight    = () => ({ animal_tag: '', weigh_date: today(), weight_kg: '', monthly_conversion: '', age_conversion: '' });
const blankMedicine  = () => ({ animal_tag: '', date: today(), medicine_name: '', dose: '', dose_price: '' });
const blankVaccine   = () => ({ animal_tag: '', date: today(), vaccine_name: '', dose_count: '', dose_price: '' });
const blankFeed      = () => ({ animal_tag: '', date: today(), amount: '', description: '' });
const blankAdmin     = () => ({ animal_tag: '', date: today(), amount: '', description: '' });
const blankNutrition = () => ({ animal_tag: '', date: today(), ingredient: '', qty_kg: '', dm_pct: '', price_per_unit: '', total_cost: '' });
const blankRevenue   = () => ({ animal_tag: '', date: today(), type: 'animal_sale', sale_weight: '', sale_price_per_kg: '', total_amount: '', buyer: '', notes: '' });

import { SEEDED_ANIMALS } from '../seededAnimals';


const TABS = [
  { key: 'animals',   icon: '🐄', label: 'Animals (main)' },
  { key: 'weights',   icon: '⚖️', label: 'اوزان / Weights' },
  { key: 'medicines', icon: '💊', label: 'ادوية / Medicine' },
  { key: 'vaccines',  icon: '💉', label: 'تحصينات / Vaccines' },
  { key: 'nutrition', icon: '🌾', label: 'شيت التغذية / Feed Nutrition' },
  { key: 'feed',      icon: '💵', label: 'تغذية / Daily Feed Cost' },
  { key: 'admin',     icon: '📋', label: 'ادارية / Admin' },
  { key: 'revenue',   icon: '💰', label: 'مبيعات / Revenue & Sales' },
];

export default function ManualEntry({ addToast }) {
  const { settings } = useSettings();
  const [tab, setTab]         = useState('animals');
  const [rows, setRows]       = useState(SEEDED_ANIMALS);   // pre-loaded with your data
  const [saving, setSaving]   = useState(false);
  const [pens, setPens]       = useState([]);
  const [animalTags, setAnimalTags] = useState([]);
  const [showPaste, setShowPaste]   = useState(false);
  // Shared-field bar state (apply one value to all rows)
  const [shared, setShared]   = useState({ entry_date: '2026-03-01', purchase_price: '32500', pen_id: '', fattening_days: '63', species: 'heifer' });

  const firstMount = useRef(true);

  useEffect(() => {
    db.pens.toArray().then(setPens);
    db.animals.toArray().then(arr => setAnimalTags(arr.map(a => a.tag).sort((a,b)=>a-b)));
  }, []);

  // Reset rows when tab changes (but NOT on the very first render, to preserve seeded data)
  useEffect(() => {
    if (firstMount.current) { firstMount.current = false; return; }
    setRows([getBlank()]);
    setShowPaste(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function getBlank() {
    if (tab === 'animals')   return blankAnimal();
    if (tab === 'weights')   return blankWeight();
    if (tab === 'medicines') return blankMedicine();
    if (tab === 'vaccines')  return blankVaccine();
    if (tab === 'nutrition') return blankNutrition();
    if (tab === 'feed')      return blankFeed();
    if (tab === 'revenue')   return blankRevenue();
    return blankAdmin();
  }

  function addRow()       { setRows(r => [...r, getBlank()]); }
  function removeRow(i)   { setRows(r => r.filter((_, idx) => idx !== i)); }
  function duplicateRow(i){ setRows(r => { const copy=[...r]; copy.splice(i+1,0,{...r[i],tag:''}); return copy; }); }
  function updateRow(i, field, val) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }
  // Fill a field value down from row i to all rows below
  function fillDown(i, field) {
    const val = rows[i][field];
    setRows(r => r.map((row, idx) => idx > i ? { ...row, [field]: val } : row));
    addToast(`↓ Filled "${val}" down to ${rows.length - i - 1} rows`);
  }
  // Apply shared field to ALL rows
  function applyShared(field) {
    const val = shared[field];
    setRows(r => r.map(row => ({ ...row, [field]: val })));
    addToast(`Applied "${val}" to all ${rows.length} rows`);
  }
  // Keyboard: Enter on last row = add new row
  function handleCellKey(e, i) {
    if (e.key === 'Enter') { e.preventDefault(); if (i === rows.length - 1) addRow(); }
  }

  // ── Parse pasted tab-separated clipboard data from Excel ────────
  function parsePaste(text) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return;
    const parsed = lines.map(line => line.split(/\t/));
    const newRows = parsed.map(cols => {
      const c = (i) => (cols[i] || '').trim();
      // Parse an Excel date serial or M/D/YYYY string to YYYY-MM-DD
      const parseDate = (v) => {
        if (!v) return today();
        // Excel serial number
        if (/^\d{5}$/.test(v)) {
          const d = new Date((parseInt(v) - 25569) * 86400 * 1000);
          return d.toISOString().split('T')[0];
        }
        // M/D/YYYY
        const m = v.match(/(\d+)\/(\d+)\/(\d{4})/);
        if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
        return v;
      };
      if (tab === 'animals') return {
        tag: c(0), pen_id: c(1), entry_date: parseDate(c(2)),
        purchase_price: c(3), entry_weight: c(4), price_per_kg_entry: c(5),
        target_sale_date: parseDate(c(6)), fattening_days: c(7),
        species: c(8) || 'heifer', lifecycle_stage: 'fattening', notes: c(9) || '',
      };
      if (tab === 'weights') return {
        animal_tag: c(0), weigh_date: parseDate(c(1)),
        weight_kg: c(2), monthly_conversion: c(3) || '', age_conversion: c(4) || '',
      };
      if (tab === 'medicines') return {
        animal_tag: c(0), date: parseDate(c(1)),
        medicine_name: c(2), dose: c(3) || '1', dose_price: c(4) || '',
      };
      if (tab === 'vaccines') return {
        animal_tag: c(0), date: parseDate(c(1)),
        vaccine_name: c(2), dose_count: c(3) || '1', dose_price: c(4) || '',
      };
      if (tab === 'nutrition') return {
        animal_tag: c(0), date: parseDate(c(1)),
        ingredient: c(2), qty_kg: c(3), dm_pct: c(4) || '',
        price_per_unit: c(5) || '', total_cost: c(6) || '',
      };
      if (tab === 'feed') return {
        animal_tag: c(0), date: parseDate(c(1)),
        amount: c(2), description: c(3) || '',
      };
      if (tab === 'admin') return {
        animal_tag: c(0), date: parseDate(c(1)),
        amount: c(2), description: c(3) || '',
      };
      if (tab === 'revenue') return {
        animal_tag: c(0), date: parseDate(c(1)), type: c(2) || 'animal_sale',
        sale_weight: c(3), sale_price_per_kg: c(4), total_amount: c(5),
        buyer: c(6) || '', notes: c(7) || '',
      };
      return getBlank();
    });
    setRows(newRows);
    setShowPaste(false);
    addToast(`📋 ${newRows.length} rows loaded from paste — review & save`);
  }

  async function handleSave() {
    setSaving(true);
    let saved = 0;
    try {
      for (const row of rows) {
        if (tab === 'animals') {
          const tag = parseInt(row.tag);
          if (!tag) continue;
          const existing = await db.animals.where('tag').equals(tag).first();
          const data = {
            tag,
            pen_id: row.pen_id || '',
            species: row.species || 'heifer',
            lifecycle_stage: row.lifecycle_stage || 'fattening',
            status: 'active',
            purchase_price: parseFloat(row.purchase_price) || 0,
            entry_weight: parseFloat(row.entry_weight) || 0,
            price_per_kg_entry: parseFloat(row.price_per_kg_entry) || 0,
            entry_date: row.entry_date || today(),
            target_sale_date: row.target_sale_date || null,
            fattening_days: parseInt(row.fattening_days) || null,
            notes: row.notes || '',
            updated_at: new Date().toISOString(),
          };
          if (existing) await db.animals.update(existing.id, data);
          else await db.animals.add({ ...data, created_at: new Date().toISOString() });
          saved++;

        } else if (tab === 'weights') {
          const tag = parseInt(row.animal_tag);
          const wt  = parseFloat(row.weight_kg);
          if (!tag || !wt) continue;
          await db.weightRecords.add({
            animal_tag: tag,
            weigh_date: row.weigh_date,
            weight_kg: wt,
            monthly_conversion: parseFloat(row.monthly_conversion) || 0,
            age_conversion: parseFloat(row.age_conversion) || 0,
          });
          saved++;

        } else if (tab === 'medicines') {
          const tag  = parseInt(row.animal_tag);
          const dose = parseFloat(row.dose) || 1;
          const price = parseFloat(row.dose_price) || 0;
          if (!tag || !row.medicine_name) continue;
          const total = dose * price;
          await db.medicineRecords.add({ animal_tag: tag, date: row.date, medicine_name: row.medicine_name, dose, dose_price: price, total_cost: total });
          if (total > 0) await db.expenses.add({ animal_tag: tag, date: row.date, category: 'medicine', amount: total, description: row.medicine_name });
          saved++;

        } else if (tab === 'vaccines') {
          const tag  = parseInt(row.animal_tag);
          const dose = parseFloat(row.dose_count) || 1;
          const price = parseFloat(row.dose_price) || 0;
          if (!tag || !row.vaccine_name) continue;
          const total = dose * price;
          await db.vaccineRecords.add({ animal_tag: tag, date: row.date, vaccine_name: row.vaccine_name, dose_count: dose, dose_price: price, total_cost: total });
          if (total > 0) await db.expenses.add({ animal_tag: tag, date: row.date, category: 'vaccine', amount: total, description: row.vaccine_name });
          saved++;

        } else if (tab === 'nutrition') {
          const tag = parseInt(row.animal_tag);
          const qty  = parseFloat(row.qty_kg)   || 0;
          const dm   = parseFloat(row.dm_pct)   || 0;
          const ppu  = parseFloat(row.price_per_unit) || 0;
          const total = parseFloat(row.total_cost) || (qty * ppu);
          if (!tag || !row.ingredient) continue;
          await db.dailyFeedCosts.add({ animal_tag: tag, date: row.date, amount: total, description: row.ingredient, qty_kg: qty, dm_pct: dm, price_per_unit: ppu });
          if (total > 0) await db.expenses.add({ animal_tag: tag, date: row.date, category: 'feed', amount: total, description: row.ingredient });
          saved++;

        } else if (tab === 'revenue') {
          const tag = parseInt(row.animal_tag);
          const saleWt  = parseFloat(row.sale_weight) || 0;
          const priceKg = parseFloat(row.sale_price_per_kg) || 0;
          const total   = parseFloat(row.total_amount) || (saleWt * priceKg);
          if (!tag || !total) continue;
          await db.revenueRecords.add({ animal_tag: tag, date: row.date, type: row.type || 'animal_sale', amount: total, description: `${row.buyer ? row.buyer + ' · ' : ''}${saleWt}kg @ ${priceKg}/kg`, notes: row.notes || '' });
          saved++;

        } else if (tab === 'feed') {
          const tag = parseInt(row.animal_tag);
          const amt = parseFloat(row.amount);
          if (!tag || !amt) continue;
          await db.dailyFeedCosts.add({ animal_tag: tag, date: row.date, amount: amt, description: row.description || 'Feed' });
          await db.expenses.add({ animal_tag: tag, date: row.date, category: 'feed', amount: amt, description: row.description || 'Feed' });
          saved++;

        } else if (tab === 'admin') {
          const tag = parseInt(row.animal_tag);
          const amt = parseFloat(row.amount);
          if (!tag || !amt) continue;
          await db.expenses.add({ animal_tag: tag, date: row.date, category: 'admin', amount: amt, description: row.description || '' });
          saved++;
        }
      }
      addToast(`✅ Saved ${saved} record${saved !== 1 ? 's' : ''}`);
      setRows([getBlank()]);
      // refresh tags
      db.animals.toArray().then(arr => setAnimalTags(arr.map(a => a.tag).sort((a,b)=>a-b)));
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
    setSaving(false);
  }

  const cur = settings.currency;

  return (
    <div className="manual-entry animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>✏️ Manual Data Entry</h1>
          <p>Enter data row-by-row, matching your spreadsheet exactly</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-ghost btn-sm" onClick={() => setRows(SEEDED_ANIMALS)}
            title="Re-load the 165 sample animals from the screenshot">
            🐄 Load Sample (165)
          </button>
          <button className="btn btn-ghost" onClick={() => setShowPaste(s => !s)}
            style={showPaste ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}>
            📋 Paste from Excel
          </button>
          <button className="btn btn-ghost" onClick={addRow}>+ Add Row</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Saving...' : `💾 Save ${rows.length} Row${rows.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="me-tabs glass-card">
        {TABS.map(t => (
          <button key={t.key} className={`me-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Paste from Spreadsheet panel */}
      <PastePanel show={showPaste} onToggle={() => setShowPaste(s => !s)} onPaste={parsePaste} tab={tab} />

      {/* Shared Field Bar — Animals only */}
      {tab === 'animals' && (
        <SharedFieldBar shared={shared} setShared={setShared} applyShared={applyShared} pens={pens} settings={settings} />
      )}

      {/* Column hints */}
      <ColumnHint tab={tab} cur={cur} />

      {/* Spreadsheet Grid */}
      <div className="glass-card me-grid-card">
        <div className="me-table-wrap">
          <table className="me-table">
            <thead>
              <tr>
                <th style={{width:36}}>#</th>
                {tab === 'animals'   && <AnimalsHead cur={cur} />}
                {tab === 'weights'   && <WeightsHead />}
                {tab === 'medicines' && <MedHead cur={cur} />}
                {tab === 'vaccines'  && <VaxHead cur={cur} />}
                {tab === 'nutrition' && <NutritionHead cur={cur} />}
                {tab === 'feed'      && <FeedHead cur={cur} />}
                {tab === 'admin'     && <AdminHead cur={cur} />}
                {tab === 'revenue'   && <RevenueHead cur={cur} />}
                <th style={{width:36}}></th>
                <th style={{width:28}} title="Duplicate row"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="row-num">{i + 1}</td>
                  {tab === 'animals'   && <AnimalsRow row={row} i={i} update={updateRow} pens={pens} settings={settings} fillDown={fillDown} onKey={handleCellKey} />}
                  {tab === 'weights'   && <WeightsRow row={row} i={i} update={updateRow} tags={animalTags} onKey={handleCellKey} />}
                  {tab === 'medicines' && <MedRow     row={row} i={i} update={updateRow} tags={animalTags} onKey={handleCellKey} />}
                  {tab === 'vaccines'  && <VaxRow     row={row} i={i} update={updateRow} tags={animalTags} onKey={handleCellKey} />}
                  {tab === 'nutrition' && <NutritionRow row={row} i={i} update={updateRow} tags={animalTags} cur={cur} onKey={handleCellKey} />}
                  {tab === 'feed'      && <FeedRow    row={row} i={i} update={updateRow} tags={animalTags} onKey={handleCellKey} />}
                  {tab === 'admin'     && <AdminRow   row={row} i={i} update={updateRow} tags={animalTags} onKey={handleCellKey} />}
                  {tab === 'revenue'   && <RevenueRow row={row} i={i} update={updateRow} tags={animalTags} cur={cur} onKey={handleCellKey} />}
                  <td style={{display:'flex', gap:2}}>
                    <button className="del-row" onClick={() => duplicateRow(i)} title="Duplicate row">⧉</button>
                    <button className="del-row" onClick={() => removeRow(i)} title="Remove row">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="me-footer">
          <button className="btn btn-ghost btn-sm" onClick={addRow}>+ Add Another Row</button>
          <span className="text-secondary text-sm">{rows.length} row{rows.length !== 1 ? 's' : ''} ready</span>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Saving...' : '💾 Save All'}
          </button>
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <p className="text-xs text-secondary" style={{textAlign:'center',marginTop:8}}>
        Tip: <kbd>Tab</kbd> move between cells · <kbd>Enter</kbd> on last row adds new row · <kbd>⧉</kbd> duplicate · double-click cell to fill-down
      </p>
    </div>
  );
}

// ─── Paste Panel ───────────────────────────────────────
const COLUMN_MAP = {
  animals:   ['الرأة (Tag)', 'الحوش (Pen)', 'تاريخ الدخول', 'سعر الشراء', 'وز الدخول', 'سعر ك الدخول', 'تاريخ الاستيعاد', 'وقت التربية', 'Species'],
  weights:   ['الرأة (Tag)', 'تاريخ الوزن', 'الوزن (kg)', 'التحويل الشهري', 'تحويل العمر'],
  medicines: ['الرأة (Tag)', 'التاريخ', 'اسم الدواء', 'الجرعة', 'سعر الجرعة'],
  vaccines:  ['الرأة (Tag)', 'التاريخ', 'اسم التطعيم', 'عدد الجرعات', 'سعر الجرعة'],
  nutrition: ['الرأة (Tag)', 'التاريخ', 'المكون', 'الكمية (kg)', 'DM%', 'السعر/kg', 'الإجمالي'],
  feed:      ['الرأة (Tag)', 'التاريخ', 'التكلفة', 'ملاحظة'],
  admin:     ['الرأة (Tag)', 'التاريخ', 'المبلغ', 'البيان'],
  revenue:   ['الرأة (Tag)', 'التاريخ', 'النوع', 'وزن البيع', 'سعر الكيلو', 'الإجمالي', 'المشتري', 'ملاحظة'],
};

function PastePanel({ show, onToggle, onPaste, tab }) {
  const [text, setText] = useState('');
  const cols = COLUMN_MAP[tab] || [];

  if (!show) return null;

  return (
    <div className="paste-panel glass-card">
      <div className="paste-header">
        <div>
          <h3>📋 Paste from Excel / Spreadsheet</h3>
          <p className="text-sm text-secondary">Select cells in Excel → Copy (Ctrl+C) → Paste below. Dates auto-converted.</p>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={onToggle}>✕</button>
      </div>

      <div className="paste-col-map">
        <span className="text-xs text-secondary" style={{marginBottom:4,display:'block'}}>Expected column order (left → right):</span>
        <div className="paste-cols">
          {cols.map((c, i) => (
            <span key={i} className="paste-col-badge">
              <span className="paste-col-num">{i + 1}</span>{c}
            </span>
          ))}
        </div>
      </div>

      <textarea
        className="paste-area"
        placeholder={`Paste your Excel data here (${cols.length} columns)...\n\nExample:\n4000\t7A\t3/1/2026\t32500\t244\t133`}
        value={text}
        onChange={e => setText(e.target.value)}
        rows={8}
        autoFocus
      />

      <div className="paste-footer">
        <span className="text-sm text-secondary">
          {text ? `${text.trim().split(/\r?\n/).filter(l=>l.trim()).length} rows detected` : 'No data yet'}
        </span>
        <div className="flex gap-sm">
          <button className="btn btn-ghost btn-sm" onClick={() => setText('')}>Clear</button>
          <button className="btn btn-primary" onClick={() => { if (text.trim()) onPaste(text); }} disabled={!text.trim()}>
            ✅ Load {text ? text.trim().split(/\r?\n/).filter(l=>l.trim()).length : 0} Rows
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Field Bar (Animals) ────────────────────────────────────
function SharedFieldBar({ shared, setShared, applyShared, pens, settings }) {
  const set = (f) => (e) => setShared(s => ({ ...s, [f]: e.target.value }));
  return (
    <div className="shared-bar glass-card">
      <span className="shared-bar-label">⚡ Apply to ALL rows:</span>

      <div className="shared-field">
        <label>Entry Date</label>
        <input className="me-cell" type="date" value={shared.entry_date} onChange={set('entry_date')} />
        <button className="btn btn-xs" onClick={() => applyShared('entry_date')}>Apply</button>
      </div>

      <div className="shared-field">
        <label>Purchase Price</label>
        <input className="me-cell" type="number" placeholder="32500" value={shared.purchase_price} onChange={set('purchase_price')} />
        <button className="btn btn-xs" onClick={() => applyShared('purchase_price')}>Apply</button>
      </div>

      <div className="shared-field">
        <label>Fatten Days</label>
        <input className="me-cell" type="number" placeholder="63" value={shared.fattening_days} onChange={set('fattening_days')} />
        <button className="btn btn-xs" onClick={() => applyShared('fattening_days')}>Apply</button>
      </div>

      <div className="shared-field">
        <label>Pen</label>
        <select className="me-cell" value={shared.pen_id} onChange={set('pen_id')}>
          <option value="">—</option>
          {pens.length > 0
            ? pens.map(p => <option key={p.id} value={p.id}>{p.id}</option>)
            : ['1A','2A','3A','4A','5A','6A','7A','8A','9A','10A'].map(p => <option key={p} value={p}>{p}</option>)
          }
        </select>
        <button className="btn btn-xs" onClick={() => applyShared('pen_id')}>Apply</button>
      </div>

      <div className="shared-field">
        <label>Species</label>
        <select className="me-cell" value={shared.species} onChange={set('species')}>
          {(settings.species || ['heifer','buffalo','bull']).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-xs" onClick={() => applyShared('species')}>Apply</button>
      </div>
    </div>
  );
}

// ─── Column Hint Banners ───────────────────────────────────────────
function ColumnHint({ tab, cur }) {
  const       hints = {
    animals:   'الرأة · الحوش · تاريخ الدخول · سعر الشراء · وز الدخول · سعر ك الدخول · تاريخ الاستيعاد · وقت التربية',
    weights:   'الرأة · تاريخ الوزن · الوزن (kg) · التحويل الشهري · تحويل العمر',
    medicines: `الرأة · التاريخ · اسم الدواء · الجرعة · سعر الجرعة (${cur})`,
    vaccines:  `الرأة · التاريخ · اسم التطعيم · عدد الجرعات · سعر الجرعة (${cur})`,
    nutrition: `الرأة · التاريخ · المكون/العلف · الكمية (kg) · DM% · السعر/${cur} · الإجمالي`,
    feed:      `الرأة · التاريخ · التكلفة (${cur}) · ملاحظة`,
    admin:     `الرأة · التاريخ · التكلفة (${cur}) · البيان`,
    revenue:   `الرأة · التاريخ · النوع · وزن البيع (kg) · سعر الكيلو · الإجمالي · المشتري`,
  };
  return (
    <div className="me-hint">
      <span className="me-hint-label">📋 Arabic columns:</span>
      <span className="me-hint-text">{hints[tab]}</span>
    </div>
  );
}

// ─── ANIMALS TAB ──────────────────────────────────────────────────
function AnimalsHead({ cur }) {
  return <>
    <th>الرأة / Tag *</th>
    <th>الحوش / Pen</th>
    <th>تاريخ الدخول / Entry Date</th>
    <th>سعر الشراء / Purchase ({cur})</th>
    <th>وز الدخول / Entry Wt (kg)</th>
    <th>سعر ك / Price/kg</th>
    <th>تاريخ الاستيعاد / Target Sale</th>
    <th>وقت التربية / Fatten Days</th>
    <th>Species</th>
  </>;
}

function AnimalsRow({ row, i, update, pens, settings, fillDown, onKey }) {
  const u = (field) => (e) => update(i, field, e.target.value);
  const fd = (field) => () => fillDown && fillDown(i, field);
  const k  = (e) => onKey && onKey(e, i);
  return <>
    <td><input className="me-cell" type="number" placeholder="4000" value={row.tag}
      onChange={u('tag')} onKeyDown={k} /></td>
    <td>
      <select className="me-cell" value={row.pen_id} onChange={u('pen_id')}>
        <option value="">—</option>
        {pens.length > 0
          ? pens.map(p => <option key={p.id} value={p.id}>{p.id}</option>)
          : ['1A','2A','3A','4A','5A','6A','7A','8A','9A','10A'].map(p => <option key={p} value={p}>{p}</option>)
        }
      </select>
    </td>
    <td title="Double-click to fill down" onDoubleClick={fd('entry_date')}>
      <input className="me-cell" type="date" value={row.entry_date} onChange={u('entry_date')} onKeyDown={k} />
    </td>
    <td title="Double-click to fill down" onDoubleClick={fd('purchase_price')}>
      <input className="me-cell" type="number" placeholder="32500" value={row.purchase_price} onChange={u('purchase_price')} onKeyDown={k} />
    </td>
    <td><input className="me-cell" type="number" placeholder="244" value={row.entry_weight} onChange={u('entry_weight')} onKeyDown={k} /></td>
    <td><input className="me-cell" type="number" placeholder="133" value={row.price_per_kg_entry} onChange={u('price_per_kg_entry')} onKeyDown={k} /></td>
    <td><input className="me-cell" type="date" value={row.target_sale_date} onChange={u('target_sale_date')} /></td>
    <td title="Double-click to fill down" onDoubleClick={fd('fattening_days')}>
      <input className="me-cell" type="number" placeholder="63" value={row.fattening_days} onChange={u('fattening_days')} onKeyDown={k} />
    </td>
    <td>
      <select className="me-cell" value={row.species} onChange={u('species')}>
        {settings.species.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </td>
  </>;
}

// ─── WEIGHTS TAB ──────────────────────────────────────────────────
function WeightsHead() {
  return <>
    <th>الرأة / Tag *</th>
    <th>تاريخ الوزن / Date *</th>
    <th>الوزن / Weight (kg) *</th>
    <th>التحويل الشهري</th>
    <th>تحويل العمر</th>
  </>;
}
function WeightsRow({ row, i, update, tags }) {
  return <>
    <TagCell row={row} i={i} update={update} tags={tags} field="animal_tag" />
    <td><input className="me-cell" type="date" value={row.weigh_date} onChange={e=>update(i,'weigh_date',e.target.value)} /></td>
    <td><input className="me-cell" type="number" step="0.1" placeholder="265" value={row.weight_kg} onChange={e=>update(i,'weight_kg',e.target.value)} /></td>
    <td><input className="me-cell" type="number" step="0.01" placeholder="0" value={row.monthly_conversion} onChange={e=>update(i,'monthly_conversion',e.target.value)} /></td>
    <td><input className="me-cell" type="number" step="0.01" placeholder="0" value={row.age_conversion} onChange={e=>update(i,'age_conversion',e.target.value)} /></td>
  </>;
}

// ─── MEDICINE TAB ─────────────────────────────────────────────────
function MedHead({ cur }) {
  return <>
    <th>الرأة / Tag *</th>
    <th>التاريخ / Date</th>
    <th>اسم الدواء / Medicine *</th>
    <th>الجرعة / Dose</th>
    <th>سعر الجرعة / Price ({cur})</th>
    <th>الإجمالي / Total</th>
  </>;
}
function MedRow({ row, i, update, tags }) {
  const total = (parseFloat(row.dose)||1) * (parseFloat(row.dose_price)||0);
  return <>
    <TagCell row={row} i={i} update={update} tags={tags} field="animal_tag" />
    <td><input className="me-cell" type="date" value={row.date} onChange={e=>update(i,'date',e.target.value)} /></td>
    <td><input className="me-cell" placeholder="اسم الدواء" value={row.medicine_name} onChange={e=>update(i,'medicine_name',e.target.value)} /></td>
    <td><input className="me-cell" type="number" step="0.01" placeholder="1" value={row.dose} onChange={e=>update(i,'dose',e.target.value)} /></td>
    <td><input className="me-cell" type="number" step="0.01" placeholder="0" value={row.dose_price} onChange={e=>update(i,'dose_price',e.target.value)} /></td>
    <td><span className="me-computed font-mono">{total > 0 ? total.toFixed(2) : '—'}</span></td>
  </>;
}

// ─── VACCINE TAB ──────────────────────────────────────────────────
function VaxHead({ cur }) {
  return <>
    <th>الرأة / Tag *</th>
    <th>التاريخ / Date</th>
    <th>التطعيم / Vaccine *</th>
    <th>عدد الجرعات</th>
    <th>سعر الجرعة ({cur})</th>
    <th>الإجمالي / Total</th>
  </>;
}
function VaxRow({ row, i, update, tags }) {
  const total = (parseFloat(row.dose_count)||1) * (parseFloat(row.dose_price)||0);
  return <>
    <TagCell row={row} i={i} update={update} tags={tags} field="animal_tag" />
    <td><input className="me-cell" type="date" value={row.date} onChange={e=>update(i,'date',e.target.value)} /></td>
    <td><input className="me-cell" placeholder="اسم التطعيم" value={row.vaccine_name} onChange={e=>update(i,'vaccine_name',e.target.value)} /></td>
    <td><input className="me-cell" type="number" step="0.01" placeholder="1" value={row.dose_count} onChange={e=>update(i,'dose_count',e.target.value)} /></td>
    <td><input className="me-cell" type="number" step="0.01" placeholder="0" value={row.dose_price} onChange={e=>update(i,'dose_price',e.target.value)} /></td>
    <td><span className="me-computed font-mono">{total > 0 ? total.toFixed(2) : '—'}</span></td>
  </>;
}

// ─── FEED TAB ─────────────────────────────────────────────────────
function FeedHead({ cur }) {
  return <>
    <th>الرأة / Tag *</th>
    <th>التاريخ / Date</th>
    <th>التكلفة / Cost ({cur}) *</th>
    <th>ملاحظة / Note</th>
  </>;
}
function FeedRow({ row, i, update, tags }) {
  return <>
    <TagCell row={row} i={i} update={update} tags={tags} field="animal_tag" />
    <td><input className="me-cell" type="date" value={row.date} onChange={e=>update(i,'date',e.target.value)} /></td>
    <td><input className="me-cell" type="number" step="0.01" placeholder="0.00" value={row.amount} onChange={e=>update(i,'amount',e.target.value)} /></td>
    <td><input className="me-cell" placeholder="وصف..." value={row.description} onChange={e=>update(i,'description',e.target.value)} /></td>
  </>;
}

// ─── ADMIN TAB ────────────────────────────────────────────────────
function AdminHead({ cur }) {
  return <>
    <th>الرأة / Tag *</th>
    <th>التاريخ / Date</th>
    <th>المبلغ / Amount ({cur}) *</th>
    <th>البيان / Description</th>
  </>;
}
function AdminRow({ row, i, update, tags }) {
  return <>
    <TagCell row={row} i={i} update={update} tags={tags} field="animal_tag" />
    <td><input className="me-cell" type="date" value={row.date} onChange={e=>update(i,'date',e.target.value)} /></td>
    <td><input className="me-cell" type="number" step="0.01" placeholder="0.00" value={row.amount} onChange={e=>update(i,'amount',e.target.value)} /></td>
    <td><input className="me-cell" placeholder="البيان..." value={row.description} onChange={e=>update(i,'description',e.target.value)} /></td>
  </>;
}

// ─── Shared: Tag cell with datalist autocomplete ───────────────────
function TagCell({ row, i, update, tags, field }) {
  const listId = `tags-${i}-${field}`;
  return (
    <td>
      <input className="me-cell" type="number" placeholder="4000" list={listId}
        value={row[field]} onChange={e => update(i, field, e.target.value)} />
      <datalist id={listId}>
        {tags.map(t => <option key={t} value={t} />)}
      </datalist>
    </td>
  );
}

// ─── FEED NUTRITION (شيت التغذية) ────────────────────────────────
// Matches the wide sheet: per-ingredient rows with qty, DM%, price, total
const FEED_INGREDIENTS = [
  'علف مركز', 'ردة قمح', 'نخالة ذرة', 'دريس برسيم', 'سيلاج', 'بنجر سكر',
  'حبوب ذرة', 'سوياbeen', 'فيتامينات', 'معادن', 'ملح', 'بيكربونات', 'أخرى',
];

function NutritionHead({ cur }) {
  return <>
    <th>الرأة / Tag *</th>
    <th>التاريخ / Date</th>
    <th>المكون / Ingredient *</th>
    <th>الكمية / Qty (kg) *</th>
    <th>DM %</th>
    <th>DM (kg)</th>
    <th>سعر الوحدة / Price ({cur}/kg)</th>
    <th>الإجمالي / Total ({cur})</th>
    <th>ملاحظة</th>
  </>;
}

function NutritionRow({ row, i, update, tags, cur }) {
  const qty   = parseFloat(row.qty_kg)        || 0;
  const dm    = parseFloat(row.dm_pct)        || 0;
  const ppu   = parseFloat(row.price_per_unit)|| 0;
  const dmKg  = qty * (dm / 100);
  const total = parseFloat(row.total_cost) || (qty * ppu);
  return <>
    <TagCell row={row} i={i} update={update} tags={tags} field="animal_tag" />
    <td><input className="me-cell" type="date" value={row.date} onChange={e=>update(i,'date',e.target.value)} /></td>
    <td>
      <input className="me-cell" placeholder="اسم المكون" list={`ing-${i}`} value={row.ingredient} onChange={e=>update(i,'ingredient',e.target.value)} />
      <datalist id={`ing-${i}`}>{FEED_INGREDIENTS.map(ing=><option key={ing} value={ing}/>)}</datalist>
    </td>
    <td><input className="me-cell" type="number" step="0.01" placeholder="0.0" value={row.qty_kg} onChange={e=>update(i,'qty_kg',e.target.value)} /></td>
    <td><input className="me-cell" type="number" step="0.01" placeholder="86" value={row.dm_pct} onChange={e=>update(i,'dm_pct',e.target.value)} /></td>
    <td><span className="me-computed font-mono">{dmKg > 0 ? dmKg.toFixed(3) : '—'}</span></td>
    <td><input className="me-cell" type="number" step="0.001" placeholder="0.00" value={row.price_per_unit} onChange={e=>update(i,'price_per_unit',e.target.value)} /></td>
    <td>
      <input className="me-cell" type="number" step="0.01" placeholder="auto" value={row.total_cost}
        onChange={e=>update(i,'total_cost',e.target.value)}
        style={total > 0 ? { color: 'var(--accent-hover)' } : {}}
      />
      {!row.total_cost && total > 0 && <span className="me-auto-hint">{total.toFixed(2)}</span>}
    </td>
    <td><input className="me-cell" placeholder="ملاحظة..." value={row.notes||''} onChange={e=>update(i,'notes',e.target.value)} /></td>
  </>;
}

// ─── REVENUE / SALES (مبيعات) ────────────────────────────────────
const REVENUE_TYPES = [
  { value: 'animal_sale', label: 'بيع رأس / Animal Sale' },
  { value: 'milk',        label: 'لبن / Milk Sales' },
  { value: 'calf_sale',   label: 'بيع عجل / Calf Sale' },
  { value: 'manure',      label: 'سماد / Manure' },
  { value: 'other',       label: 'أخرى / Other' },
];

function RevenueHead({ cur }) {
  return <>
    <th>الرأة / Tag *</th>
    <th>التاريخ / Date</th>
    <th>النوع / Type</th>
    <th>وزن البيع / Sale Wt (kg)</th>
    <th>سعر الكيلو / Price/kg ({cur})</th>
    <th>الإجمالي / Total ({cur}) *</th>
    <th>المشتري / Buyer</th>
    <th>ملاحظة</th>
  </>;
}

function RevenueRow({ row, i, update, tags, cur }) {
  const saleWt  = parseFloat(row.sale_weight)     || 0;
  const priceKg = parseFloat(row.sale_price_per_kg)|| 0;
  const computed = saleWt > 0 && priceKg > 0 ? (saleWt * priceKg) : 0;
  return <>
    <TagCell row={row} i={i} update={update} tags={tags} field="animal_tag" />
    <td><input className="me-cell" type="date" value={row.date} onChange={e=>update(i,'date',e.target.value)} /></td>
    <td>
      <select className="me-cell" value={row.type} onChange={e=>update(i,'type',e.target.value)}>
        {REVENUE_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
    </td>
    <td><input className="me-cell" type="number" step="0.1" placeholder="350" value={row.sale_weight} onChange={e=>update(i,'sale_weight',e.target.value)} /></td>
    <td><input className="me-cell" type="number" step="0.5" placeholder="240" value={row.sale_price_per_kg} onChange={e=>update(i,'sale_price_per_kg',e.target.value)} /></td>
    <td>
      <input className="me-cell" type="number" step="0.01" placeholder="auto" value={row.total_amount}
        onChange={e=>update(i,'total_amount',e.target.value)}
        style={{ color: 'var(--win)', fontWeight: 600 }}
      />
      {!row.total_amount && computed > 0 && <span className="me-auto-hint" style={{color:'var(--win)'}}>{computed.toLocaleString()}</span>}
    </td>
    <td><input className="me-cell" placeholder="اسم المشتري" value={row.buyer||''} onChange={e=>update(i,'buyer',e.target.value)} /></td>
    <td><input className="me-cell" placeholder="ملاحظة..." value={row.notes||''} onChange={e=>update(i,'notes',e.target.value)} /></td>
  </>;
}
