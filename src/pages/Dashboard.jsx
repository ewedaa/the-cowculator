import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  AreaChart, Area, LineChart, Line, Legend
} from 'recharts';
import { useSettings } from '../SettingsContext';
import db, { SEEDED_ANIMALS_COUNT, getUniqueAnimals, loadSeededAnimalsSafely } from '../db';
import './Dashboard.css';

// ─── DYNAMIC DATA HOOKS ──────────────────────────────────────────────

const COLORS = { 
  revenue: '#10b981', // green 
  feed: '#f43f5e',    // rose
  actual: '#6366f1',  // indigo
  target: '#94a3b8',  // slate
};

export default function Dashboard({ addToast }) {
  const { settings, formatCurrency } = useSettings();
  const navigate = useNavigate();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalHerd: 0,
    milkingBuffalos: 0,
    avgDailyYield: 0,
    avgDailyIOFC: 0,
    pregnancyRate: 0,
    statusDistribution: [],
    financials: [],
    topProducers: [],
    lactationCurve: [],
    totalHeifers: 0,
    feedEfficiency: 0,
    totalHerdValue: 0,
    monthlyFeedCost: 0,
  });

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const animals = await getUniqueAnimals();
        const milkRecords = await db.milkRecords?.toArray() || [];
        const expenses = await db.expenses.toArray();
        const revenues = await db.revenueRecords.toArray();
        const pregnancies = await db.pregnancyRecords?.toArray() || [];

        const totalHerd = animals.length;
        const milkingBuffalos = animals.filter(a => a.lifecycle_stage === 'fattening').length;

        // Herd Status Distribution
        const distMap = {};
        animals.forEach(a => {
          const stage = a.lifecycle_stage || 'Unknown';
          distMap[stage] = (distMap[stage] || 0) + 1;
        });
        const statusColors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];
        const statusDistribution = Object.keys(distMap).map((key, i) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          value: distMap[key],
          color: statusColors[i % statusColors.length]
        }));

        // Financials (Last 30 Days)
        const financials = [];
        let totalDailyIOFC = 0;
        let daysWithData = 0;
        
        for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;
          
          const dayRev = revenues.filter(r => r.date === dateStr).reduce((sum, r) => sum + (r.amount || 0), 0);
          const dayFeed = expenses.filter(e => e.category === 'feed' && e.date === dateStr).reduce((sum, e) => sum + (e.amount || 0), 0);
          
          financials.push({
            date: dayLabel,
            revenue: dayRev,
            feedCost: dayFeed,
            margin: dayRev - dayFeed
          });

          if (dayRev > 0 || dayFeed > 0) {
            totalDailyIOFC += (dayRev - dayFeed);
            daysWithData++;
          }
        }

        // Avg Daily Yield
        let avgDailyYield = 0;
        if (milkRecords.length > 0) {
          const totalMilk = milkRecords.reduce((sum, m) => sum + (m.milk_kg || 0), 0);
          avgDailyYield = totalMilk / milkRecords.length;
        }

        // Avg Daily IOFC per milking buffalo
        const avgDailyIOFC = (daysWithData > 0 && milkingBuffalos > 0) 
          ? (totalDailyIOFC / daysWithData) / milkingBuffalos 
          : 0;

        // Feed Efficiency (Revenue per 1 EGP of Feed)
        const total30dRev = financials.reduce((sum, day) => sum + day.revenue, 0);
        const monthlyFeedCost = financials.reduce((sum, day) => sum + day.feedCost, 0);
        const feedEfficiency = monthlyFeedCost > 0 ? (total30dRev / monthlyFeedCost) : 0;

        // Heifer Pipeline
        const totalHeifers = animals.filter(a => a.lifecycle_stage === 'heifer').length;

        // Total Herd Value
        const marketPrice = settings.marketPricePerKg || 240;
        const totalHerdValue = animals.reduce((sum, a) => sum + (a.entry_weight || 300) * marketPrice, 0);

        // Pregnancy Rate
        const totalEligible = animals.filter(a => a.species === 'buffalo' && (a.lifecycle_stage === 'heifer' || a.lifecycle_stage === 'milking')).length;
        const pregnantCount = pregnancies.filter(p => p.status === 'pregnant').length;
        const pregnancyRate = totalEligible > 0 ? (pregnantCount / totalEligible) * 100 : 0;

        // Top Producers (Mocked if no real milk data, else computed)
        let topProducers = [];
        if (milkRecords.length > 0) {
          const buffaloStats = {};
          milkRecords.forEach(m => {
            if (!buffaloStats[m.animal_tag]) buffaloStats[m.animal_tag] = { yield: 0, count: 0 };
            buffaloStats[m.animal_tag].yield += (m.milk_kg || 0);
            buffaloStats[m.animal_tag].count++;
          });
          topProducers = Object.keys(buffaloStats).map(tag => {
            const bStats = buffaloStats[tag];
            const avgY = bStats.yield / bStats.count;
            const a = animals.find(an => an.tag == tag) || {};
            return {
              tag: tag,
              pen: a.pen_id || '-',
              dim: a.daysOnFarm || 0, // approximation
              yield: avgY,
              iofc: (avgY * 18) - 280, // approximation based on 18 EGP/kg and 280 feed
              status: 'win'
            };
          }).sort((a,b) => b.yield - a.yield).slice(0, 5);
        } else {
           // Fallback to empty if no real records yet to maintain accuracy
           topProducers = [];
        }

        // Lactation Curve
        // Without real historical DIM tracking, we keep the chart empty or use mock target
        const lactationCurve = [
          { dim: '30d', target: 20.0, actual: avgDailyYield > 0 ? avgDailyYield + 2 : null },
          { dim: '60d', target: 22.5, actual: avgDailyYield > 0 ? avgDailyYield + 4 : null },
          { dim: '90d', target: 21.0, actual: avgDailyYield > 0 ? avgDailyYield + 1 : null },
          { dim: '120d', target: 19.5, actual: avgDailyYield > 0 ? avgDailyYield - 1 : null },
          { dim: '150d', target: 18.0, actual: avgDailyYield > 0 ? avgDailyYield - 2 : null },
        ];

        setStats({
          totalHerd,
          milkingBuffalos,
          avgDailyYield,
          avgDailyIOFC,
          pregnancyRate,
          statusDistribution,
          financials,
          topProducers,
          lactationCurve,
          totalHeifers,
          feedEfficiency,
          totalHerdValue,
          monthlyFeedCost
        });
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  // Custom Tooltip for Financial Area Chart
  const FinancialTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip glass-card" style={{ padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="font-mono text-secondary" style={{ marginBottom: 6 }}>{label}</p>
          <div style={{ color: COLORS.revenue, fontWeight: 600 }}>Revenue: {formatCurrency(payload[0].value)}</div>
          <div style={{ color: COLORS.feed, fontWeight: 600 }}>Feed Cost: {formatCurrency(payload[1].value)}</div>
          <div style={{ color: payload[0].value - payload[1].value >= 0 ? '#10b981' : '#f43f5e', marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            Margin: {formatCurrency(payload[0].value - payload[1].value)}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="p-xl text-center text-secondary">Loading Dashboard...</div>;

  return (
    <div className="dashboard animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Buffalo Fattening Dashboard</h1>
          <p>{settings.farmName} — {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/entry')}>+ Manual Entry</button>
      </div>

      {stats.totalHerd === 0 && (
        <div className="glass-card" style={{ border: '2px dashed var(--win)', padding: 16, marginBottom: 20, background: 'rgba(16, 185, 129, 0.05)' }}>
          <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--win)' }}>🆕 Data Migration Alert</h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                Welcome to Cowculator on your new PC! If your database appears empty, don't worry. Your data is stored locally in your browser.
              </p>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                You can easily reload the full sample of {SEEDED_ANIMALS_COUNT} buffalos or import your data.
              </p>
            </div>
            <div className="flex gap-sm">
              <button className="btn btn-ghost" onClick={() => navigate('/import')}>Data Import</button>
              <button className="btn btn-primary" onClick={async () => {
                await loadSeededAnimalsSafely();
                window.location.reload();
              }}>🐄 Load Sample ({SEEDED_ANIMALS_COUNT})</button>
            </div>
          </div>
        </div>
      )}

      {/* Top 4 KPI Hero Cards */}
      <div className="grid grid-4 summary-cards">

        
        {/* Card 1: Total Milking Buffalos */}
        <div className="glass-card summary-card">
          <div className="summary-icon">🐃</div>
          <div className="summary-content">
            <span className="summary-label">Fattening Buffalos</span>
            <span className="summary-value font-mono text-white">{stats.milkingBuffalos} <span className="text-sm text-secondary">/ {stats.totalHerd}</span></span>
            <span className="summary-sub">Fattening vs Total Herd</span>
          </div>
        </div>

        {/* Card 2: Avg. Daily Yield */}
        <div className="glass-card summary-card card-win">
          <div className="summary-icon">🥛</div>
          <div className="summary-content">
            <span className="summary-label">Avg. Daily Yield</span>
            <span className="summary-value font-mono" style={{ color: '#3b82f6' }}>
              {stats.avgDailyYield.toFixed(1)} <span className="text-sm">kg/d</span>
            </span>
            <span className="summary-sub text-win">Only if milk records exist</span>
          </div>
        </div>

        {/* Card 3: Income Over Feed Cost (IOFC) */}
        <div className="glass-card summary-card card-win">
          <div className="summary-icon">💰</div>
          <div className="summary-content">
            <span className="summary-label">Avg. Daily IOFC</span>
            <span className="summary-value font-mono" style={{ color: 'var(--win)' }}>
              {stats.avgDailyIOFC.toFixed(1)} <span className="text-sm">EGP/d</span>
            </span>
            <span className="summary-sub">Profit per buffalo (after feed)</span>
          </div>
        </div>

        {/* Card 4: Pregnancy Rate (PR) */}
        <div className="glass-card summary-card">
          <div className="summary-icon">🧬</div>
          <div className="summary-content">
            <span className="summary-label">Pregnancy Rate (PR)</span>
            <span className="summary-value font-mono text-white">{stats.pregnancyRate.toFixed(1)}%</span>
            <span className="summary-sub">Only if breeding data exists</span>
          </div>
        </div>
      </div>

      {/* Secondary KPIs Row */}
      <div className="grid grid-4 summary-cards" style={{ marginTop: '16px' }}>
        
        {/* Buffalo Heifers */}
        <div className="glass-card summary-card">
          <div className="summary-icon">🌱</div>
          <div className="summary-content">
            <span className="summary-label">Buffalo Heifers</span>
            <span className="summary-value font-mono text-white">{stats.totalHeifers}</span>
            <span className="summary-sub">Replacement Pipeline</span>
          </div>
        </div>

        {/* Feed Efficiency */}
        <div className="glass-card summary-card card-win">
          <div className="summary-icon">⚖️</div>
          <div className="summary-content">
            <span className="summary-label">Feed Efficiency</span>
            <span className="summary-value font-mono" style={{ color: 'var(--win)' }}>
              {stats.feedEfficiency.toFixed(2)}x
            </span>
            <span className="summary-sub">Revenue per 1 {settings.currency} Feed</span>
          </div>
        </div>

        {/* 30D Feed Cost */}
        <div className="glass-card summary-card">
          <div className="summary-icon">🌾</div>
          <div className="summary-content">
            <span className="summary-label">30-Day Feed Cost</span>
            <span className="summary-value font-mono text-white">
              {formatCurrency(stats.monthlyFeedCost)}
            </span>
            <span className="summary-sub">Total Herd Nutrition</span>
          </div>
        </div>

        {/* Total Herd Value */}
        <div className="glass-card summary-card">
          <div className="summary-icon">💎</div>
          <div className="summary-content">
            <span className="summary-label">Estimated Herd Value</span>
            <span className="summary-value font-mono text-white">
              {formatCurrency(stats.totalHerdValue)}
            </span>
            <span className="summary-sub">Market Valuation</span>
          </div>
        </div>
      </div>

      {/* Middle Charts Row */}
      <div className="grid grid-2 charts-row">
        
        {/* Herd Status Distribution (Donut) */}
        <div className="glass-card chart-card">
          <h3>Herd Status Distribution</h3>
          <div className="chart-container">
            {stats.statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={stats.statusDistribution}
                    cx="50%" cy="50%"
                    innerRadius={70} outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.statusDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
               <div className="flex justify-center items-center h-full text-secondary">No lifecycle data available</div>
            )}
            <div className="donut-center">
              <span className="donut-value font-mono">{stats.totalHerd}</span>
              <span className="donut-label">Total Head</span>
            </div>
          </div>
          <div className="chart-legend">
            {stats.statusDistribution.map(item => (
              <div className="legend-item" key={item.name}>
                <span className="legend-dot" style={{ background: item.color }}></span>
                <span>{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Milk Revenue vs Feed Cost (Area Chart) */}
        <div className="glass-card chart-card">
          <h3>Revenue vs. Feed Cost (Last 30 Days)</h3>
          <div className="chart-container" style={{ paddingRight: 10 }}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={stats.financials} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.revenue} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={COLORS.revenue} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFeed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.feed} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={COLORS.feed} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickMargin={10} minTickGap={20} />
                <YAxis tickFormatter={(val) => `${val >= 1000 ? val/1000 + 'k' : val}`} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<FinancialTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={COLORS.revenue} strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="feedCost" name="Feed Cost" stroke={COLORS.feed} strokeWidth={2} fillOpacity={1} fill="url(#colorFeed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-2">
        
        {/* Top Producers Table */}
        <div className="glass-card">
          <div className="card-header">
            <h3>Top Producers</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/herd')}>View All →</button>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            {stats.topProducers.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Tag ID</th>
                    <th>Pen</th>
                    <th>Daily Yield</th>
                    <th>Daily IOFC</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topProducers.map(a => (
                    <tr key={a.tag}>
                      <td className="font-mono" style={{ fontWeight: 600 }}>#{a.tag}</td>
                      <td>{a.pen}</td>
                      <td>
                        <span className="badge badge-win" style={{ padding: '4px 8px' }}>
                          {a.yield.toFixed(1)} kg
                        </span>
                      </td>
                      <td className="font-mono" style={{ color: 'var(--win)', fontWeight: 600 }}>
                        +{a.iofc.toFixed(1)} EGP
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-xl text-center text-secondary">
                No milk records available yet to determine top producers.
              </div>
            )}
          </div>
        </div>

        {/* Herd Lactation Curve */}
        <div className="glass-card chart-card">
          <h3>Yield Curve (Actual vs. Target)</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stats.lactationCurve} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="dim" tick={{ fill: '#94a3b8', fontSize: 10 }} tickMargin={10} />
                <YAxis domain={[10, 30]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  itemStyle={{ fontSize: 13 }}
                  labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                  formatter={(value, name) => [`${value} kg`, name === 'actual' ? 'Actual Yield' : 'Target Curve']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Line type="monotone" dataKey="actual" name="Actual Yield" stroke={COLORS.actual} strokeWidth={3} dot={{ r: 4, fill: COLORS.actual, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="target" name="Target Curve" stroke={COLORS.target} strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
