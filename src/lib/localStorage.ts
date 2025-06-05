interface AppData {
  players: any[];
  teams: any;
  matches: any[];
  formattedMatches: any[];
  schedulingRules: any[];
  schedule: any;
  lastUpdated: string;
}

const STORAGE_KEY = 'roundscheduler_data';

export const saveToLocalStorage = (data: Partial<AppData>) => {
  try {
    const existingData = loadFromLocalStorage();
    const updatedData = {
      ...existingData,
      ...data,
      lastUpdated: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    return true;
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    return false;
  }
};

export const loadFromLocalStorage = (): AppData => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
  }

  return {
    players: [],
    teams: null,
    matches: [],
    formattedMatches: [],
    schedulingRules: [],
    schedule: null,
    lastUpdated: '',
  };
};

export const clearLocalStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
    return false;
  }
};

export const hasStoredData = (): boolean => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data !== null && data !== '';
  } catch (error) {
    return false;
  }
};

export const getStorageSize = (): string => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const sizeInBytes = new Blob([data]).size;
      const sizeInKB = (sizeInBytes / 1024).toFixed(1);
      return `${sizeInKB} KB`;
    }
  } catch (error) {
    console.error('Failed to calculate storage size:', error);
  }
  return '0 KB';
};
