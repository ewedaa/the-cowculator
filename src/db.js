import Dexie from 'dexie';
import { SEEDED_ANIMALS } from './seededAnimals';

const db = new Dexie('CowculatorDB');

db.version(2).stores({
  animals: '++id, tag, species, pen_id, status, lifecycle_stage, entry_date',
  expenses: '++id, animal_tag, date, category',
  weightRecords: '++id, animal_tag, weigh_date',
  vaccineRecords: '++id, animal_tag, date, vaccine_name',
  medicineRecords: '++id, animal_tag, date, medicine_name',
  dailyFeedCosts: '++id, animal_tag, date',
  revenueRecords: '++id, animal_tag, date, type',
  pens: 'id',
  importLogs: '++id, filename, date',
  milkRecords: '++id, animal_tag, date',
  pregnancyRecords: '++id, animal_tag, date, status'
});

export default db;

// Migration: Ensure all imported or created animals default to 'buffalo'
if (typeof window !== 'undefined') {
  setTimeout(async () => {
    try {
      const existing = await db.animals.toArray();
      if (existing.length === 0) {
        // Automatically seed the 165 buffalos on new PC empty startup
        const toAdd = SEEDED_ANIMALS.map(a => ({
          ...a,
          species: 'buffalo'
        }));
        await db.animals.bulkAdd(toAdd);
        console.log('Successfully auto-seeded the 165 animals on first empty PC launch.');
      } else {
        for (const animal of existing) {
          if (animal.species === 'heifer' || !animal.species) {
            await db.animals.update(animal.id, { species: 'buffalo' });
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, 100);
}


// Helper to reset the database
export async function resetDatabase() {
  await db.delete();
  window.location.reload();
}

// Get settings from localStorage (for use in non-React contexts)
function getMarketPrice() {
  try {
    const settings = JSON.parse(localStorage.getItem('cowculator-settings') || '{}');
    return settings.marketPricePerKg || 240;
  } catch { return 240; }
}

// Get all animals with computed profit/loss
export async function getAnimalsWithPL(marketPriceOverride) {
  const animals = await db.animals.toArray();
  const expenses = await db.expenses.toArray();
  const revenues = await db.revenueRecords.toArray();
  const weights = await db.weightRecords.toArray();
  const marketPrice = marketPriceOverride || getMarketPrice();

  return animals.map(animal => {
    const animalExpenses = expenses.filter(e => e.animal_tag === animal.tag);
    const animalRevenues = revenues.filter(r => r.animal_tag === animal.tag);
    const animalWeights = weights.filter(w => w.animal_tag === animal.tag)
      .sort((a, b) => new Date(b.weigh_date) - new Date(a.weigh_date));

    const totalFeed = animalExpenses.filter(e => e.category === 'feed').reduce((s, e) => s + (e.amount || 0), 0);
    const totalVaccines = animalExpenses.filter(e => e.category === 'vaccine').reduce((s, e) => s + (e.amount || 0), 0);
    const totalMedicine = animalExpenses.filter(e => e.category === 'medicine').reduce((s, e) => s + (e.amount || 0), 0);
    const totalAdmin = animalExpenses.filter(e => e.category === 'admin').reduce((s, e) => s + (e.amount || 0), 0);
    const totalOther = animalExpenses.filter(e => !['feed','vaccine','medicine','admin'].includes(e.category)).reduce((s, e) => s + (e.amount || 0), 0);
    const totalExpenses = totalFeed + totalVaccines + totalMedicine + totalAdmin + totalOther;
    const totalCost = (animal.purchase_price || 0) + totalExpenses;
    const totalRevenue = animalRevenues.reduce((s, r) => s + (r.amount || 0), 0);
    const profitLoss = totalRevenue - totalCost;

    const currentWeight = animalWeights.length > 0 ? animalWeights[0].weight_kg : animal.entry_weight;
    const weightGain = currentWeight - (animal.entry_weight || 0);
    const daysOnFarm = animal.entry_date
      ? Math.floor((new Date() - new Date(animal.entry_date)) / (1000 * 60 * 60 * 24))
      : 0;

    // Estimated market value: current weight * configurable market price per kg
    const estimatedValue = (currentWeight || 0) * marketPrice;
    const unrealizedPL = estimatedValue - totalCost;

    return {
      ...animal,
      totalFeed,
      totalVaccines,
      totalMedicine,
      totalAdmin,
      totalOther,
      totalExpenses,
      totalCost,
      totalRevenue,
      profitLoss,
      unrealizedPL,
      estimatedValue,
      currentWeight,
      weightGain,
      daysOnFarm,
      status_indicator: unrealizedPL >= 0 ? 'win' : 'lose',
      costPerKg: weightGain > 0 ? totalCost / weightGain : 0,
      dailyGain: daysOnFarm > 0 ? weightGain / daysOnFarm : 0,
    };
  });
}

// Get farm-wide summary stats
export async function getFarmSummary(marketPriceOverride) {
  const animalsWithPL = await getAnimalsWithPL(marketPriceOverride);
  const totalAnimals = animalsWithPL.length;
  const winners = animalsWithPL.filter(a => a.unrealizedPL >= 0);
  const losers = animalsWithPL.filter(a => a.unrealizedPL < 0);
  
  const totalInvestment = animalsWithPL.reduce((s, a) => s + a.totalCost, 0);
  const totalEstimatedValue = animalsWithPL.reduce((s, a) => s + a.estimatedValue, 0);
  const totalUnrealizedPL = totalEstimatedValue - totalInvestment;
  const avgDailyGain = totalAnimals > 0 
    ? animalsWithPL.reduce((s, a) => s + a.dailyGain, 0) / totalAnimals 
    : 0;

  return {
    totalAnimals,
    winnersCount: winners.length,
    losersCount: losers.length,
    winRate: totalAnimals > 0 ? (winners.length / totalAnimals * 100) : 0,
    totalInvestment,
    totalEstimatedValue,
    totalUnrealizedPL,
    avgDailyGain,
    topPerformer: animalsWithPL.sort((a, b) => b.unrealizedPL - a.unrealizedPL)[0] || null,
    worstPerformer: animalsWithPL.sort((a, b) => a.unrealizedPL - b.unrealizedPL)[0] || null,
  };
}
