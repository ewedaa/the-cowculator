import { useState, useEffect } from 'react';
import { getAnimalsWithPL } from '../db';
import { useSettings } from '../SettingsContext';
import db from '../db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';
import './Reports.css';

export default function Reports({ addToast }) {
  const { settings, formatCurrency } = useSettings();
  const [animals, setAnimals] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [period, setPeriod] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [animalData, expenseData] = await Promise.all([getAnimalsWithPL(settings.marketPricePerKg), db.expenses.toArray()]);
    setAnimals(animalData);
    setExpenses(expenseData);
    setLoading(false);
  }

  const totalInvestment = animals.reduce((s, a) => s + a.totalCost, 0);
  const totalValue = animals.reduce((s, a) => s + a.estimatedValue, 0);
  const totalPL = totalValue - totalInvestment;
  const totalPurchase = animals.reduce((s, a) => s + (a.purchase_price || 0), 0);
  const totalFeed = animals.reduce((s, a) => s + a.totalFeed, 0);
  const totalVaccines = animals.reduce((s, a) => s + a.totalVaccines, 0);
  const totalMedicine = animals.reduce((s, a) => s + a.totalMedicine, 0);
  const totalAdmin = animals.reduce((s, a) => s + a.totalAdmin, 0);

  const costBreakdown = [
    { name: 'Purchase', value: totalPurchase, color: '#6366f1' },
    { name: 'Feed', value: totalFeed, color: '#10b981' },
    { name: 'Vaccines', value: totalVaccines, color: '#3b82f6' },
    { name: 'Medicine', value: totalMedicine, color: '#f59e0b' },
    { name: 'Admin', value: totalAdmin, color: '#8b5cf6' },
  ].filter(c => c.value > 0);

  const penPerformance = {};
  animals.forEach(a => {
    const pen = a.pen_id || 'Unassigned';
    if (!penPerformance[pen]) penPerformance[pen] = { pen, animals: 0, totalCost: 0, totalValue: 0, avgGain: 0 };
    penPerformance[pen].animals++;
    penPerformance[pen].totalCost += a.totalCost;
    penPerformance[pen].totalValue += a.estimatedValue;
    penPerformance[pen].avgGain += a.dailyGain || 0;
  });
  const penData = Object.values(penPerformance).map(p => ({ ...p, avgGain: p.avgGain / p.animals, pl: p.totalValue - p.totalCost }));

  const fmt = (v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(1)}K` : v?.toFixed(0) || '0';

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Cowculator — ${settings.farmName} Financial Report`, 14, 22);
    doc.setFontSize(10);
    doc.text(`${settings.farmName} · Generated ${new Date().toLocaleDateString()}`, 14, 30);
    doc.setFontSize(12);
    doc.text('Financial Summary', 14, 44);
    doc.autoTable({
      startY: 48, head: [['Metric', `Value (${settings.currency})`]],
      body: [
        ['Total Animals', animals.length],
        ['Total Investment', totalInvestment.toLocaleString()],
        ['Est. Market Value', totalValue.toLocaleString()],
        ['Unrealized P/L', totalPL.toLocaleString()],
        ['Purchase Costs', totalPurchase.toLocaleString()],
        ['Feed Costs', totalFeed.toLocaleString()],
        ['Vaccine Costs', totalVaccines.toLocaleString()],
        ['Medicine Costs', totalMedicine.toLocaleString()],
        ['Admin Costs', totalAdmin.toLocaleString()],
      ],
      theme: 'striped',
    });
    doc.text('Individual Animal P/L', 14, doc.lastAutoTable.finalY + 16);
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Tag', 'Pen', 'Weight', 'Total Cost', 'Est. Value', 'P/L', 'Status']],
      body: animals.slice(0, 50).map(a => [
        `#${a.tag}`, a.pen_id || '-', `${a.currentWeight?.toFixed(0)} kg`,
        a.totalCost.toLocaleString(), a.estimatedValue.toLocaleString(),
        a.unrealizedPL.toLocaleString(), a.status_indicator === 'win' ? 'WIN' : 'LOSE',
      ]),
      theme: 'striped',
    });
    doc.save('cowculator-report.pdf');
    addToast('PDF report downloaded');
  }

  function exportCSV() {
    const data = animals.map(a => ({
      Tag: a.tag, Pen: a.pen_id, Species: a.species, EntryDate: a.entry_date,
      EntryWeight: a.entry_weight, CurrentWeight: a.currentWeight?.toFixed(0),
      DailyGain: a.dailyGain?.toFixed(2), DaysOnFarm: a.daysOnFarm,
      PurchasePrice: a.purchase_price, FeedCost: a.totalFeed, VaccineCost: a.totalVaccines,
      MedicineCost: a.totalMedicine, AdminCost: a.totalAdmin, TotalCost: a.totalCost,
      EstValue: a.estimatedValue, ProfitLoss: a.unrealizedPL, Status: a.status_indicator,
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cowculator-report.csv'; a.click();
    addToast('CSV report downloaded');
  }

  if (loading) return <div className="empty-state"><div className="empty-state-icon">⏳</div><h3>Generating reports...</h3></div>;

  return (
    <div className="reports animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1>Reports</h1><p>Farm-wide financial statements & analytics</p></div>
        <div className="flex gap-sm">
          <button className="btn btn-ghost" onClick={exportCSV}>📄 Export CSV</button>
          <button className="btn btn-primary" onClick={exportPDF}>📊 Export PDF</button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="glass-card report-section">
        <h3>📋 Financial Summary</h3>
        <div className="grid grid-4" style={{ marginTop: 16 }}>
          <div className="report-metric"><span className="rm-label">Total Investment</span><span className="rm-value font-mono">{formatCurrency(totalInvestment)}</span></div>
          <div className="report-metric"><span className="rm-label">Est. Market Value</span><span className="rm-value font-mono">{formatCurrency(totalValue)}</span></div>
          <div className="report-metric"><span className="rm-label">Unrealized P/L</span><span className="rm-value font-mono" style={{ color: totalPL >= 0 ? 'var(--win)' : 'var(--lose)' }}>{totalPL >= 0 ? '+' : ''}{formatCurrency(totalPL)}</span></div>
          <div className="report-metric"><span className="rm-label">Avg Cost/Animal</span><span className="rm-value font-mono">{animals.length > 0 ? formatCurrency(totalInvestment / animals.length) : '0'}</span></div>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Cost Breakdown Pie */}
        <div className="glass-card report-section">
          <h3>Cost Breakdown</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" stroke="none">
                {costBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} formatter={v => `${v.toLocaleString()} EGP`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-legend" style={{ flexWrap: 'wrap' }}>
            {costBreakdown.map(c => (
              <div key={c.name} className="legend-item"><span className="legend-dot" style={{ background: c.color }}></span><span>{c.name}: {fmt(c.value)}</span></div>
            ))}
          </div>
        </div>

        {/* Pen Performance */}
        <div className="glass-card report-section">
          <h3>Pen Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={penData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="pen" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
              <Bar dataKey="pl" fill="#6366f1" radius={[6, 6, 0, 0]} name="P/L (EGP)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
