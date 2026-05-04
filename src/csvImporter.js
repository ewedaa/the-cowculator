import Papa from 'papaparse';
import db from './db';

// CSV file mapping to their import handlers
const FILE_HANDLERS = {
  'ملف العجلات.csv': importFeedSheet,
  'ملف1 العجلات.csv': importPenRegistry,
  'ملف11 العجلات.csv': importCostLedger,
  'ملف111 العجلات.csv': importWeightRecords,
  'ملف1111 العجلات.csv': importMedicineLog,
  'ملف11111 العجلات.csv': importAdminCosts,
  'ملف111111 العجلات.csv': importVaccineRecords,
  'ملف1111111 العجلات.csv': importDailyFeedCosts,
  'ملف11111111 العجلات.csv': importMainDashboard,
};

// Detect file type by matching known filenames
export function detectFileType(filename) {
  for (const [key, handler] of Object.entries(FILE_HANDLERS)) {
    if (filename === key || filename.includes(key)) {
      return { type: key, handler };
    }
  }
  // Try to detect by column headers
  return null;
}

// Parse a CSV file and return structured data
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => resolve(results),
      error: (error) => reject(error),
    });
  });
}

// Main import dispatcher
export async function importCSVFile(file) {
  const filename = file.name;
  const detection = detectFileType(filename);
  
  if (!detection) {
    // Try auto-detect by columns
    const results = await parseCSV(file);
    return await autoDetectAndImport(results.data, filename);
  }

  const results = await parseCSV(file);
  const imported = await detection.handler(results.data);
  
  // Log the import
  await db.importLogs.add({
    filename,
    date: new Date().toISOString(),
    rowsImported: imported,
    type: detection.type,
  });

  return { filename, rowsImported: imported, type: detection.type };
}

// Import pen registry (ملف1)
async function importPenRegistry(data) {
  let count = 0;
  for (const row of data) {
    const penId = row[0]?.trim();
    if (!penId || penId === 'الحوش') continue;
    
    await db.pens.put({ id: penId, name: `Pen ${penId}`, capacity: 50, type: 'fattening' });
    count++;
  }
  return count;
}

// Import cost ledger (ملف11) - رقم العجلة, سعر الشراء, تغذية, تحصينات, ادوية, إدارية, اجمالي المصارف, اجمالي التكلفة
async function importCostLedger(data) {
  let count = 0;
  for (const row of data) {
    const tag = parseInt(row[0]);
    if (isNaN(tag)) continue;

    const purchasePrice = parseFloat(row[1]) || 0;
    const feedCost = parseFloat(row[2]) || 0;
    const vaccineCost = parseFloat(row[3]) || 0;
    const medicineCost = parseFloat(row[4]) || 0;
    const adminCost = parseFloat(row[5]) || 0;

    // Upsert animal
    const existing = await db.animals.where('tag').equals(tag).first();
    if (existing) {
      await db.animals.update(existing.id, { purchase_price: purchasePrice });
    } else {
      await db.animals.add({
        tag,
        species: 'buffalo',
        pen_id: '',
        status: 'active',
        lifecycle_stage: 'heifer',
        purchase_price: purchasePrice,
        entry_weight: 0,
        entry_date: null,
        notes: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Add expense records
    if (feedCost > 0) {
      await db.expenses.add({ animal_tag: tag, date: new Date().toISOString(), category: 'feed', amount: feedCost, description: 'Imported from CSV' });
    }
    if (vaccineCost > 0) {
      await db.expenses.add({ animal_tag: tag, date: new Date().toISOString(), category: 'vaccine', amount: vaccineCost, description: 'Imported from CSV' });
    }
    if (medicineCost > 0) {
      await db.expenses.add({ animal_tag: tag, date: new Date().toISOString(), category: 'medicine', amount: medicineCost, description: 'Imported from CSV' });
    }
    if (adminCost > 0) {
      await db.expenses.add({ animal_tag: tag, date: new Date().toISOString(), category: 'admin', amount: adminCost, description: 'Imported from CSV' });
    }

    count++;
  }
  return count;
}

// Import weight records (ملف111) - Animal ID, Pen, Entry Date, Entry Weight, Weighing 1, Weighing 2, Monthly Conv, Age Conv
async function importWeightRecords(data) {
  let count = 0;
  // Skip header rows (first 2 rows)
  const startIndex = data.findIndex(row => !isNaN(parseInt(row[0])));
  
  for (let i = startIndex; i < data.length; i++) {
    const row = data[i];
    const tag = parseInt(row[0]);
    if (isNaN(tag)) continue;

    const penId = row[1]?.trim() || '';
    const entryDate = row[2]?.trim() || '';
    const entryWeight = parseFloat(row[3]) || 0;
    const weighing1 = parseFloat(row[4]) || 0;
    const weighing2 = parseFloat(row[5]) || 0;
    const monthlyConv = parseFloat(row[6]) || 0;
    const ageConv = parseFloat(row[7]) || 0;

    // Upsert animal with pen and entry data
    const existing = await db.animals.where('tag').equals(tag).first();
    if (existing) {
      await db.animals.update(existing.id, {
        pen_id: penId,
        entry_date: entryDate,
        entry_weight: entryWeight,
        updated_at: new Date().toISOString(),
      });
    } else {
      await db.animals.add({
        tag, species: 'buffalo', pen_id: penId, status: 'active',
        lifecycle_stage: 'heifer', purchase_price: 0,
        entry_weight: entryWeight, entry_date: entryDate,
        notes: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    }

    // Add weight records
    if (weighing1 > 0) {
      await db.weightRecords.add({
        animal_tag: tag,
        weigh_date: '2026-04-01',
        weight_kg: weighing1,
        monthly_conversion: monthlyConv,
        age_conversion: ageConv,
      });
    }
    if (weighing2 > 0) {
      await db.weightRecords.add({
        animal_tag: tag,
        weigh_date: '2026-04-30',
        weight_kg: weighing2,
        monthly_conversion: monthlyConv,
        age_conversion: ageConv,
      });
    }

    count++;
  }
  return count;
}

// Import medicine log (ملف1111)
async function importMedicineLog(data) {
  let count = 0;
  for (const row of data) {
    const tag = parseInt(row[0]);
    if (isNaN(tag)) continue;

    const medicineName = row[1]?.trim() || '';
    const dose = parseFloat(row[2]) || 0;
    const dosePrice = parseFloat(row[3]) || 0;
    const total = parseFloat(row[4]) || 0;

    if (medicineName && total > 0) {
      await db.medicineRecords.add({
        animal_tag: tag,
        date: new Date().toISOString(),
        medicine_name: medicineName,
        dose,
        dose_price: dosePrice,
        total_cost: total,
      });
      count++;
    }
  }
  return count;
}

// Import admin costs (ملف11111)
async function importAdminCosts(data) {
  let count = 0;
  for (const row of data) {
    const tag = parseInt(row[0]);
    if (isNaN(tag)) continue;

    const totalAdmin = parseFloat(row[row.length - 1]) || 0;
    if (totalAdmin > 0) {
      await db.expenses.add({
        animal_tag: tag,
        date: new Date().toISOString(),
        category: 'admin',
        amount: totalAdmin,
        description: 'Administrative costs (imported)',
      });
      count++;
    }
  }
  return count;
}

// Import vaccine records (ملف111111)
async function importVaccineRecords(data) {
  let count = 0;
  for (const row of data) {
    const tag = parseInt(row[0]);
    if (isNaN(tag)) continue;

    const date = row[1]?.trim() || new Date().toISOString();
    const vaccineName = row[2]?.trim() || 'Unknown';
    const doseCount = parseFloat(row[3]) || 0;
    const dosePrice = parseFloat(row[4]) || 0;
    const total = parseFloat(row[5]) || 0;

    if (total > 0) {
      await db.vaccineRecords.add({
        animal_tag: tag,
        date,
        vaccine_name: vaccineName,
        dose_count: doseCount,
        dose_price: dosePrice,
        total_cost: total,
      });

      // Also add as expense
      await db.expenses.add({
        animal_tag: tag,
        date,
        category: 'vaccine',
        amount: total,
        description: `${vaccineName} (imported)`,
      });
      count++;
    }
  }
  return count;
}

// Import daily feed costs (ملف1111111)
async function importDailyFeedCosts(data) {
  let count = 0;
  if (data.length < 2) return count;

  // First row has headers including dates
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const tag = parseInt(row[0]);
    if (isNaN(tag)) continue;

    const penId = row[1]?.trim() || '';
    const entryDate = row[2]?.trim() || '';
    const purchasePrice = parseFloat(row[3]) || 0;
    const entryWeight = parseFloat(row[4]) || 0;

    // Upsert animal
    const existing = await db.animals.where('tag').equals(tag).first();
    if (existing) {
      await db.animals.update(existing.id, {
        pen_id: penId || existing.pen_id,
        entry_date: entryDate || existing.entry_date,
        entry_weight: entryWeight || existing.entry_weight,
        purchase_price: purchasePrice || existing.purchase_price,
        updated_at: new Date().toISOString(),
      });
    } else {
      await db.animals.add({
        tag, species: 'buffalo', pen_id: penId, status: 'active',
        lifecycle_stage: 'heifer', purchase_price: purchasePrice,
        entry_weight: entryWeight, entry_date: entryDate,
        notes: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    }

    // Find the TOTAL column and add feed as a single lump
    // The total is typically near the end of the row
    const totalColIndex = headers.findIndex(h => h?.trim() === 'TOTAL' || h?.trim() === 'total');
    if (totalColIndex > 0) {
      const feedTotal = parseFloat(row[totalColIndex]) || 0;
      if (feedTotal > 0) {
        await db.expenses.add({
          animal_tag: tag,
          date: new Date().toISOString(),
          category: 'feed',
          amount: feedTotal,
          description: 'Daily feed total (imported)',
        });
      }
    }

    count++;
  }
  return count;
}

// Import main dashboard (ملف11111111)
async function importMainDashboard(data) {
  let count = 0;
  const startIndex = data.findIndex(row => !isNaN(parseInt(row[0])));
  
  for (let i = startIndex; i < data.length; i++) {
    const row = data[i];
    const tag = parseInt(row[0]);
    if (isNaN(tag)) continue;

    const penId = row[1]?.trim() || '';
    const entryDate = row[2]?.trim() || '';
    const purchasePrice = parseFloat(row[3]) || 0;
    const entryWeight = parseFloat(row[4]) || 0;
    const daysOnFarm = parseFloat(row[5]) || 0;

    const existing = await db.animals.where('tag').equals(tag).first();
    if (existing) {
      await db.animals.update(existing.id, {
        pen_id: penId || existing.pen_id,
        entry_date: entryDate || existing.entry_date,
        entry_weight: entryWeight || existing.entry_weight,
        purchase_price: purchasePrice || existing.purchase_price,
        updated_at: new Date().toISOString(),
      });
    } else {
      await db.animals.add({
        tag, species: 'buffalo', pen_id: penId, status: 'active',
        lifecycle_stage: 'heifer', purchase_price: purchasePrice,
        entry_weight: entryWeight, entry_date: entryDate,
        notes: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    }
    count++;
  }
  return count;
}

// Import feed sheet (ملف العجلات) - complex nutrition data
async function importFeedSheet(data) {
  // This file has pen-level feed formulations, not per-animal
  // We'll store the raw data for reference
  return data.length;
}

// Auto-detect CSV type by column analysis
async function autoDetectAndImport(data, filename) {
  if (!data || data.length === 0) {
    return { filename, rowsImported: 0, type: 'unknown' };
  }

  const firstRow = data[0];
  const colCount = firstRow.length;

  // Try to match by column patterns
  if (colCount <= 2) {
    return { filename, rowsImported: await importPenRegistry(data), type: 'pen_registry' };
  }
  if (colCount >= 6 && colCount <= 8) {
    // Could be cost ledger or weight records
    const hasDatePattern = data.slice(1).some(row => row[2]?.includes('/'));
    if (hasDatePattern) {
      return { filename, rowsImported: await importWeightRecords(data), type: 'weight_records' };
    }
    return { filename, rowsImported: await importCostLedger(data), type: 'cost_ledger' };
  }

  return { filename, rowsImported: 0, type: 'unknown' };
}
