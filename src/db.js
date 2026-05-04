import Dexie from 'dexie';
import { SEEDED_ANIMALS } from './seededAnimals';

const db = new Dexie('CowculatorDB');
export const SEEDED_ANIMALS_COUNT = SEEDED_ANIMALS.length;
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
        // Automatically seed the sample buffalo list on first empty startup
        const toAdd = SEEDED_ANIMALS.map(a => ({
          ...a,
          species: 'buffalo'
        }));
        await db.animals.bulkAdd(toAdd);
        console.log(`Successfully auto-seeded ${SEEDED_ANIMALS_COUNT} animals on first empty PC launch.`);
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

export async function deleteAnimalAndRelatedRecords(tag) {
  const numericTag = toNumber(tag, null);
  if (numericTag == null) return false;

  const animal = await db.animals.where('tag').equals(numericTag).first();
  if (!animal) return false;

  await db.transaction(
    'rw',
    db.animals,
    db.expenses,
    db.weightRecords,
    db.vaccineRecords,
    db.medicineRecords,
    db.dailyFeedCosts,
    db.revenueRecords,
    db.milkRecords,
    db.pregnancyRecords,
    async () => {
      await db.animals.delete(animal.id);
      await db.expenses.where('animal_tag').equals(numericTag).delete();
      await db.weightRecords.where('animal_tag').equals(numericTag).delete();
      await db.vaccineRecords.where('animal_tag').equals(numericTag).delete();
      await db.medicineRecords.where('animal_tag').equals(numericTag).delete();
      await db.dailyFeedCosts.where('animal_tag').equals(numericTag).delete();
      await db.revenueRecords.where('animal_tag').equals(numericTag).delete();
      await db.milkRecords.where('animal_tag').equals(numericTag).delete();
      await db.pregnancyRecords.where('animal_tag').equals(numericTag).delete();
    }
  );

  return true;
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
  const marketPrice = toNumber(marketPriceOverride, getMarketPrice());

  return animals.map(animal => {
    const animalExpenses = expenses.filter(e => e.animal_tag === animal.tag);
    const animalRevenues = revenues.filter(r => r.animal_tag === animal.tag);
    const animalWeights = weights.filter(w => w.animal_tag === animal.tag)
      .sort((a, b) => new Date(b.weigh_date) - new Date(a.weigh_date));

    const purchasePrice = toNumber(animal.purchase_price);
    const entryWeight = toNumber(animal.entry_weight);

    const totalFeed = animalExpenses.filter(e => e.category === 'feed').reduce((s, e) => s + toNumber(e.amount), 0);
    const totalVaccines = animalExpenses.filter(e => e.category === 'vaccine').reduce((s, e) => s + toNumber(e.amount), 0);
    const totalMedicine = animalExpenses.filter(e => e.category === 'medicine').reduce((s, e) => s + toNumber(e.amount), 0);
    const totalAdmin = animalExpenses.filter(e => e.category === 'admin').reduce((s, e) => s + toNumber(e.amount), 0);
    const totalOther = animalExpenses.filter(e => !['feed','vaccine','medicine','admin'].includes(e.category)).reduce((s, e) => s + toNumber(e.amount), 0);
    const totalExpenses = totalFeed + totalVaccines + totalMedicine + totalAdmin + totalOther;
    const totalCost = purchasePrice + totalExpenses;
    const totalRevenue = animalRevenues.reduce((s, r) => s + toNumber(r.amount), 0);
    const profitLoss = totalRevenue - totalCost;

    const currentWeight = animalWeights.length > 0
      ? toNumber(animalWeights[0].weight_kg, entryWeight)
      : entryWeight;
    const weightGain = currentWeight - entryWeight;
    const daysOnFarm = animal.entry_date
      ? Math.floor((new Date() - new Date(animal.entry_date)) / (1000 * 60 * 60 * 24))
      : 0;

    // Estimated market value: current weight * configurable market price per kg
    const estimatedValue = (currentWeight || 0) * marketPrice;
    const unrealizedPL = estimatedValue - totalCost;

    return {
      ...animal,
      purchase_price: purchasePrice,
      entry_weight: entryWeight,
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
