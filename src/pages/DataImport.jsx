import { useState, useRef } from 'react';
import { importCSVFile } from '../csvImporter';
import db from '../db';
import './DataImport.css';

const EXPECTED_FILES = [
  { name: 'ملف العجلات.csv', desc: 'Feed/Nutrition Sheet', icon: '🌾' },
  { name: 'ملف1 العجلات.csv', desc: 'Pen Registry', icon: '🏠' },
  { name: 'ملف11 العجلات.csv', desc: 'Cost Ledger', icon: '💰' },
  { name: 'ملف111 العجلات.csv', desc: 'Weight Records', icon: '⚖️' },
  { name: 'ملف1111 العجلات.csv', desc: 'Medicine Log', icon: '💊' },
  { name: 'ملف11111 العجلات.csv', desc: 'Admin Costs', icon: '📋' },
  { name: 'ملف111111 العجلات.csv', desc: 'Vaccine Records', icon: '💉' },
  { name: 'ملف1111111 العجلات.csv', desc: 'Daily Feed Costs', icon: '🌾' },
  { name: 'ملف11111111 العجلات.csv', desc: 'Main Dashboard', icon: '📊' },
];

export default function DataImport({ addToast }) {
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [importLogs, setImportLogs] = useState([]);
  const fileRef = useRef();

  useState(() => {
    db.importLogs.toArray().then(setImportLogs);
  }, []);

  async function handleFiles(files) {
    const fileList = Array.from(files).filter(f => f.name.endsWith('.csv'));
    if (fileList.length === 0) { addToast('No CSV files found', 'error'); return; }

    setImporting(true);
    setResults([]);
    const newResults = [];

    for (let i = 0; i < fileList.length; i++) {
      setProgress(((i + 1) / fileList.length) * 100);
      try {
        const result = await importCSVFile(fileList[i]);
        newResults.push({ ...result, status: 'success' });
      } catch (err) {
        newResults.push({ filename: fileList[i].name, status: 'error', error: err.message });
      }
    }

    setResults(newResults);
    setImporting(false);
    setProgress(100);
    
    const successCount = newResults.filter(r => r.status === 'success').length;
    addToast(`Imported ${successCount} of ${fileList.length} files`);
    db.importLogs.toArray().then(setImportLogs);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  async function handleClearData() {
    if (!confirm('This will delete ALL data. Are you sure?')) return;
    await Promise.all([
      db.animals.clear(), db.expenses.clear(), db.weightRecords.clear(),
      db.vaccineRecords.clear(), db.medicineRecords.clear(), db.dailyFeedCosts.clear(),
      db.revenueRecords.clear(), db.pens.clear(), db.importLogs.clear(),
    ]);
    setResults([]);
    setImportLogs([]);
    addToast('All data cleared');
  }

  return (
    <div className="data-import animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1>Data Import</h1><p>Import your CSV files to initialize the system</p></div>
        <button className="btn btn-ghost" onClick={handleClearData} style={{ color: 'var(--lose)' }}>🗑️ Clear All Data</button>
      </div>

      {/* Drop Zone */}
      <div
        className={`glass-card drop-zone ${dragOver ? 'drop-zone-active' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" multiple accept=".csv" onChange={e => handleFiles(e.target.files)} style={{ display: 'none' }} />
        <div className="drop-icon">{importing ? '⏳' : '📥'}</div>
        <h3>{importing ? 'Importing...' : 'Drop CSV files here'}</h3>
        <p>or click to browse · Supports all 9 ملف العجلات files</p>
        {importing && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="glass-card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
          <h3 style={{ marginBottom: 12 }}>Import Results</h3>
          <div className="import-results">
            {results.map((r, i) => (
              <div key={i} className={`import-result ${r.status}`}>
                <span>{r.status === 'success' ? '✅' : '❌'}</span>
                <span className="result-filename">{r.filename}</span>
                <span className="result-detail font-mono">
                  {r.status === 'success' ? `${r.rowsImported} rows` : r.error}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expected Files Guide */}
      <div className="glass-card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
        <h3 style={{ marginBottom: 12 }}>Expected CSV Files</h3>
        <div className="file-guide">
          {EXPECTED_FILES.map(f => (
            <div key={f.name} className="file-guide-item">
              <span className="fg-icon">{f.icon}</span>
              <div>
                <span className="fg-name">{f.name}</span>
                <span className="fg-desc">{f.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
