import { createContext, useContext, useState, useEffect } from 'react';

const DEFAULT_SETTINGS = {
  // Farm Info
  farmName: 'Shash Farm',
  farmLogo: '🐄',
  
  // Financial
  currency: 'EGP',
  marketPricePerKg: 240,
  
  // Animal Categories
  species: ['heifer', 'cow', 'buffalo', 'calf', 'bull'],
  lifecycleStages: ['heifer', 'lactating', 'dry', 'calf', 'fattening', 'growing'],
  
  // Expense Categories
  expenseCategories: [
    { key: 'feed', label: 'Feed/Nutrition', icon: '🌾', color: '#10b981' },
    { key: 'vaccine', label: 'Vaccines', icon: '💉', color: '#3b82f6' },
    { key: 'medicine', label: 'Medicine', icon: '💊', color: '#f59e0b' },
    { key: 'admin', label: 'Administrative', icon: '📋', color: '#6366f1' },
    { key: 'labor', label: 'Labor', icon: '👷', color: '#8b5cf6' },
    { key: 'transport', label: 'Transport', icon: '🚛', color: '#ec4899' },
    { key: 'other', label: 'Other', icon: '📦', color: '#64748b' },
  ],
  
  // Nutrition & Feed Prices (per kg)
  nutritionItems: [
    { key: 'alfalfa', label: 'Alfalfa Hay', price: 6.5, icon: '🌾' },
    { key: 'silage', label: 'Corn Silage', price: 2.0, icon: '🌽' },
    { key: 'soybean', label: 'Soybean Meal', price: 18.5, icon: '🌱' },
    { key: 'concentrate', label: 'Dairy Concentrate', price: 14.0, icon: '🛢️' },
    { key: 'minerals', label: 'Mineral Mix', price: 25.0, icon: '🧂' },
  ],
  
  // Revenue Types
  revenueTypes: [
    { key: 'milk', label: 'Milk Sales', icon: '🥛' },
    { key: 'calf_sale', label: 'Calf Sale', icon: '🐮' },
    { key: 'animal_sale', label: 'Animal Sale', icon: '💵' },
    { key: 'manure', label: 'Manure Sales', icon: '🌿' },
    { key: 'other', label: 'Other Revenue', icon: '📦' },
  ],
  
  // Pen Management
  pens: [],
  
  // Display
  dateFormat: 'en-US',
  numberFormat: 'en',
  showProfitColors: true,
  animationsEnabled: true,
  dashboardLayout: 'default',
  defaultView: 'grid',
  itemsPerPage: 50,
  
  // Alerts & Thresholds
  lowWeightGainThreshold: 0.5,
  highCostThreshold: 50000,
  targetDailyGain: 1.2,
  
  // Backup
  autoBackup: false,
  lastBackupDate: null,
};

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('cowculator-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('cowculator-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('cowculator-settings');
  };

  const addExpenseCategory = (category) => {
    setSettings(prev => ({
      ...prev,
      expenseCategories: [...prev.expenseCategories, category],
    }));
  };

  const removeExpenseCategory = (key) => {
    setSettings(prev => ({
      ...prev,
      expenseCategories: prev.expenseCategories.filter(c => c.key !== key),
    }));
  };

  const addRevenueType = (type) => {
    setSettings(prev => ({
      ...prev,
      revenueTypes: [...prev.revenueTypes, type],
    }));
  };

  const removeRevenueType = (key) => {
    setSettings(prev => ({
      ...prev,
      revenueTypes: prev.revenueTypes.filter(t => t.key !== key),
    }));
  };

  const addSpecies = (species) => {
    setSettings(prev => ({
      ...prev,
      species: [...prev.species, species],
    }));
  };

  const removeSpecies = (species) => {
    setSettings(prev => ({
      ...prev,
      species: prev.species.filter(s => s !== species),
    }));
  };

  const addLifecycleStage = (stage) => {
    setSettings(prev => ({
      ...prev,
      lifecycleStages: [...prev.lifecycleStages, stage],
    }));
  };

  const removeLifecycleStage = (stage) => {
    setSettings(prev => ({
      ...prev,
      lifecycleStages: prev.lifecycleStages.filter(s => s !== stage),
    }));
  };

  const addNutritionItem = (item) => {
    setSettings(prev => ({
      ...prev,
      nutritionItems: [...(prev.nutritionItems || []), item],
    }));
  };

  const removeNutritionItem = (key) => {
    setSettings(prev => ({
      ...prev,
      nutritionItems: (prev.nutritionItems || []).filter(i => i.key !== key),
    }));
  };

  const updateNutritionItem = (key, updates) => {
    setSettings(prev => ({
      ...prev,
      nutritionItems: (prev.nutritionItems || []).map(i => i.key === key ? { ...i, ...updates } : i),
    }));
  };

  const formatCurrency = (val) => {
    if (val == null || isNaN(val)) return `0 ${settings.currency}`;
    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M ${settings.currency}`;
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}K ${settings.currency}`;
    return `${val.toFixed(0)} ${settings.currency}`;
  };

  const formatCurrencyFull = (val) => {
    if (val == null || isNaN(val)) return `0 ${settings.currency}`;
    return `${val.toLocaleString(settings.numberFormat)} ${settings.currency}`;
  };

  return (
    <SettingsContext.Provider value={{
      settings,
      updateSettings,
      resetSettings,
      addExpenseCategory,
      removeExpenseCategory,
      addRevenueType,
      removeRevenueType,
      addSpecies,
      removeSpecies,
      addLifecycleStage,
      removeLifecycleStage,
      addNutritionItem,
      removeNutritionItem,
      updateNutritionItem,
      formatCurrency,
      formatCurrencyFull,
      DEFAULT_SETTINGS,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
