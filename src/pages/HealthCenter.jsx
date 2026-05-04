import { useState, useEffect } from 'react';
import { useSettings } from '../SettingsContext';
import db from '../db';
import './HealthCenter.css';

export default function HealthCenter({ addToast }) {
  const { settings } = useSettings();
  const [animals, setAnimals] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [weights, setWeights] = useState([]);
  const [activeTab, setActiveTab] = useState('vaccine');
  const [form, setForm] = useState({ animal_tag: '', name: '', dose: '', dose_price: '', date: new Date().toISOString().split('T')[0], notes: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [animalList, vaccineList, medicineList, weightList] = await Promise.all([
      db.animals.toArray(),
      db.vaccineRecords.orderBy('id').reverse().limit(50).toArray(),
      db.medicineRecords.orderBy('id').reverse().limit(50).toArray(),
      db.weightRecords.orderBy('id').reverse().limit(50).toArray(),
    ]);
    setAnimals(animalList);
    setVaccines(vaccineList);
    setMedicines(medicineList);
    setWeights(weightList);
  }

  async function handleVaccineSubmit(e) {
    e.preventDefault();
    const tag = parseInt(form.animal_tag);
    if (isNaN(tag) || !form.name) return;

    const doseCount = parseFloat(form.dose) || 1;
    const dosePrice = parseFloat(form.dose_price) || 0;
    const total = doseCount * dosePrice;

    await db.vaccineRecords.add({
      animal_tag: tag, date: form.date, vaccine_name: form.name,
      dose_count: doseCount, dose_price: dosePrice, total_cost: total,
    });
    await db.expenses.add({
      animal_tag: tag, date: form.date, category: 'vaccine',
      amount: total, description: form.name,
    });
    addToast('Vaccine logged successfully');
    setForm({ ...form, name: '', dose: '', dose_price: '', notes: '' });
    loadData();
  }

  async function handleMedicineSubmit(e) {
    e.preventDefault();
    const tag = parseInt(form.animal_tag);
    if (isNaN(tag) || !form.name) return;

    const dose = parseFloat(form.dose) || 1;
    const dosePrice = parseFloat(form.dose_price) || 0;
    const total = dose * dosePrice;

    await db.medicineRecords.add({
      animal_tag: tag, date: form.date, medicine_name: form.name,
      dose, dose_price: dosePrice, total_cost: total,
    });
    await db.expenses.add({
      animal_tag: tag, date: form.date, category: 'medicine',
      amount: total, description: form.name,
    });
    addToast('Medicine logged successfully');
    setForm({ ...form, name: '', dose: '', dose_price: '', notes: '' });
    loadData();
  }

  async function handleWeightSubmit(e) {
    e.preventDefault();
    const tag = parseInt(form.animal_tag);
    const weight = parseFloat(form.dose);
    if (isNaN(tag) || isNaN(weight)) return;

    await db.weightRecords.add({
      animal_tag: tag, weigh_date: form.date, weight_kg: weight,
      monthly_conversion: 0, age_conversion: 0,
    });
    addToast('Weight recorded');
    setForm({ ...form, dose: '' });
    loadData();
  }

  async function deleteRecord(table, id) {
    await db[table].delete(id);
    addToast('Record deleted');
    loadData();
  }

  const tabs = [
    { key: 'vaccine', label: '💉 Vaccines', count: vaccines.length },
    { key: 'medicine', label: '💊 Medicine', count: medicines.length },
    { key: 'weight', label: '⚖️ Weight', count: weights.length },
  ];

  return (
    <div className="health-center animate-fade-in">
      <div className="page-header">
        <h1>Health Center</h1>
        <p>Track vaccines, medicines, and weight across your herd</p>
      </div>

      {/* Tabs */}
      <div className="health-tabs glass-card">
        {tabs.map(tab => (
          <button key={tab.key}
            className={`health-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className="tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-2">
        {/* Entry Form */}
        <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
          <h3 style={{ marginBottom: 16 }}>
            {activeTab === 'vaccine' && '💉 Log Vaccine'}
            {activeTab === 'medicine' && '💊 Log Medicine'}
            {activeTab === 'weight' && '⚖️ Record Weight'}
          </h3>
          <form onSubmit={activeTab === 'vaccine' ? handleVaccineSubmit : activeTab === 'medicine' ? handleMedicineSubmit : handleWeightSubmit}>
            <div className="form-grid" style={{ gap: 12 }}>
              <div className="form-group">
                <label>Animal *</label>
                <select className="input" value={form.animal_tag} onChange={e => setForm({ ...form, animal_tag: e.target.value })} required>
                  <option value="">Select...</option>
                  {animals.map(a => <option key={a.id} value={a.tag}>#{a.tag} — {a.pen_id || 'No Pen'}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              {activeTab !== 'weight' && (
                <div className="form-group">
                  <label>{activeTab === 'vaccine' ? 'Vaccine Name *' : 'Medicine Name *'}</label>
                  <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
              )}
              <div className="form-group">
                <label>{activeTab === 'weight' ? 'Weight (kg) *' : 'Dose Count'}</label>
                <input className="input" type="number" step="0.01" value={form.dose} onChange={e => setForm({ ...form, dose: e.target.value })} required />
              </div>
              {activeTab !== 'weight' && (
                <div className="form-group">
                  <label>Price per Dose ({settings.currency})</label>
                  <input className="input" type="number" step="0.01" value={form.dose_price} onChange={e => setForm({ ...form, dose_price: e.target.value })} />
                </div>
              )}
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}>
              {activeTab === 'vaccine' ? '💉 Log Vaccine' : activeTab === 'medicine' ? '💊 Log Medicine' : '⚖️ Record Weight'}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="glass-card">
          <div className="card-header">
            <h3>Recent Records</h3>
          </div>
          <div className="table-container" style={{ border: 'none', maxHeight: 500, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>{activeTab === 'weight' ? 'Weight' : 'Name'}</th>
                  {activeTab !== 'weight' && <th>Cost</th>}
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'vaccine' ? vaccines : activeTab === 'medicine' ? medicines : weights).map((rec, i) => (
                  <tr key={rec.id || i}>
                    <td className="font-mono" style={{ fontWeight: 600 }}>#{rec.animal_tag}</td>
                    <td>{activeTab === 'weight' ? `${rec.weight_kg} kg` : rec.vaccine_name || rec.medicine_name}</td>
                    {activeTab !== 'weight' && <td className="font-mono">{rec.total_cost?.toLocaleString()} {settings.currency}</td>}
                    <td className="text-sm text-secondary">
                      {rec.date || rec.weigh_date ? new Date(rec.date || rec.weigh_date).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <button className="btn btn-icon btn-ghost btn-sm"
                        onClick={() => deleteRecord(activeTab === 'vaccine' ? 'vaccineRecords' : activeTab === 'medicine' ? 'medicineRecords' : 'weightRecords', rec.id)}
                        title="Delete">🗑️</button>
                    </td>
                  </tr>
                ))}
                {(activeTab === 'vaccine' ? vaccines : activeTab === 'medicine' ? medicines : weights).length === 0 && (
                  <tr><td colSpan={activeTab === 'weight' ? 4 : 5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No records yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
