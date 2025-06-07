import { Player } from '../models/Player';
import { TeamsMap } from '../models/Team';
import { Match } from '../models/Match';

export interface StoredData {
  players?: Player[];
  teams?: TeamsMap;
  matches?: Match[];
  formattedMatches?: Match[];
  schedulingRules?: any[];
  schedule?: any;
  ruleConfigurations?: RuleConfigurationData[];
  optimizerSettings?: OptimizerSettings;
  lastUpdated?: string;
}

export interface RuleConfigurationData {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  type: 'builtin' | 'custom' | 'duplicated';
  category: 'team' | 'player' | 'both';
  configuredParams?: { [key: string]: any };
  code?: string; // for custom rules
  baseRuleId?: string; // for duplicated rules - references the original built-in rule
}

export interface OptimizerSettings {
  iterations: number;
  strategyId: string;
}

const STORAGE_KEY = 'roundSchedulerData';

export function saveToLocalStorage(data: Partial<StoredData>): void {
  if (typeof window === 'undefined') return;

  try {
    const existingData = loadFromLocalStorage();
    const updatedData = {
      ...existingData,
      ...data,
      lastUpdated: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

export function loadFromLocalStorage(): StoredData {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return {};
  }
}

export function clearLocalStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}

export function hasStoredData(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function getStorageSize(): string {
  if (typeof window === 'undefined') return '0 KB';

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return '0 KB';

    const bytes = new Blob([stored]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } catch {
    return 'Unknown';
  }
}
