import {
  AvoidBackToBackGames,
  AvoidFirstAndLastGame,
  AvoidReffingBeforePlaying,
  AvoidPlayingAfterSetup,
  EnsurePlayerWarmupTime,
  BalanceRefereeAssignments,
  EnsureFairFieldDistribution,
  LimitVenueTime,
  ManageRestTimeAndGaps,
  ManagePlayerGameBalance,
  CustomRule as CustomRuleClass,
  PreventTeamDoubleBooking,
  ScheduleRule,
  DetectMixedDivisionsInTimeSlot,
  PreventClubRefereeConflict,
} from '../models/ScheduleRule';
import { ScheduleHelpers } from './schedule-helpers';
import { RuleConfigurationData } from './localStorage';

export interface RuleParameter {
  name: string;
  type: 'number' | 'boolean' | 'select';
  default: any;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: any; label: string }[];
  description: string;
}

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  category: 'team' | 'player' | 'both';
  priority: number;
  enabled: boolean;
  ruleClass: any;
  parameters?: { [key: string]: RuleParameter };
}

// Central registry of all available rules
//
// 🚀 TO ADD A NEW RULE: Simply add it here with all its metadata!
// No need to touch any other files - the UI and logic will automatically pick it up.
//
export const RULES_REGISTRY: RuleDefinition[] = [
  // ===== CRITICAL RULES (Cannot be disabled) =====
  {
    id: 'prevent_team_double_booking',
    name: 'Prevent team double-booking',
    description:
      "Prevents teams from being scheduled for multiple matches at the same time slot - this is a critical rule as it's physically impossible for a team to be in two places at once.",
    category: 'team',
    priority: 10,
    enabled: true,
    ruleClass: PreventTeamDoubleBooking,
  },
  {
    id: 'avoid_playing_after_setup',
    name: 'Avoid playing immediately after setup',
    description:
      'Prevents teams from playing immediately after doing setup work - this is critical as teams need time to transition from setup duties to playing.',
    category: 'team',
    priority: 10,
    enabled: true,
    ruleClass: AvoidPlayingAfterSetup,
  },

  // ===== COMBINED RULES (Apply to both teams and players) =====
  {
    id: 'back_to_back',
    name: 'Avoid back-to-back games',
    description:
      'Prevents teams and players from playing in consecutive time slots, which could cause fatigue and scheduling conflicts.',
    category: 'both',
    priority: 5,
    enabled: true,
    ruleClass: AvoidBackToBackGames,
  },
  {
    id: 'first_last',
    name: 'Avoid having first and last game',
    description:
      "Ensures teams and players don't have to stay for the entire event duration by avoiding both the first and last games.",
    category: 'both',
    priority: 4,
    enabled: true,
    ruleClass: AvoidFirstAndLastGame,
  },
  {
    id: 'limit_venue_time',
    name: 'Limit venue time',
    description: 'Limits venue time for players and prevents teams from extended consecutive field presence.',
    category: 'both',
    priority: 2,
    enabled: true,
    ruleClass: LimitVenueTime,
    parameters: {
      maxHours: {
        name: 'Maximum Hours at Venue',
        type: 'number',
        default: 5,
        min: 1,
        max: 12,
        step: 0.5,
        description: 'Maximum hours a player should be at the venue',
      },
      minutesPerSlot: {
        name: 'Minutes per Time Slot',
        type: 'number',
        default: 40,
        min: 15,
        max: 120,
        step: 15,
        description: 'Duration of each time slot in minutes',
      },
    },
  },

  // ===== TEAM-SPECIFIC RULES =====
  {
    id: 'reffing_before',
    name: 'Avoid teams reffing before playing',
    description:
      'Prevents teams from having to referee immediately before their own game, allowing proper warm-up time.',
    category: 'team',
    priority: 4,
    enabled: true,
    ruleClass: AvoidReffingBeforePlaying,
  },
  {
    id: 'balance_referee',
    name: 'Balance referee assignments',
    description: 'Distributes referee duties fairly among all teams to ensure equal responsibility.',
    category: 'team',
    priority: 3,
    enabled: true,
    ruleClass: BalanceRefereeAssignments,
    parameters: {
      maxRefereeDifference: {
        name: 'Max Referee Difference',
        type: 'number',
        default: 1,
        min: 0,
        max: 3,
        step: 1,
        description: 'Maximum allowed difference in referee assignments between teams',
      },
    },
  },
  {
    id: 'fair_field_distribution',
    name: 'Ensure fair field distribution',
    description: 'Prevents teams from playing too many games on the same field, ensuring variety.',
    category: 'team',
    priority: 2,
    enabled: true,
    ruleClass: EnsureFairFieldDistribution,
    parameters: {
      fieldDistributionThreshold: {
        name: 'Field Distribution Threshold',
        type: 'number',
        default: 0.6,
        min: 0.3,
        max: 1.0,
        step: 0.1,
        description: 'Maximum fraction of games a team can play on one field',
      },
    },
  },

  // ===== PLAYER-SPECIFIC RULES =====
  {
    id: 'manage_rest_and_gaps',
    name: 'Manage rest time and gaps',
    description: 'Ensures players have adequate rest between games while avoiding excessive gaps.',
    category: 'player',
    priority: 1,
    enabled: true,
    ruleClass: ManageRestTimeAndGaps,
    parameters: {
      minRestSlots: {
        name: 'Minimum Rest Slots',
        type: 'number',
        default: 2,
        min: 1,
        max: 10,
        step: 1,
        description: 'Minimum number of time slots players must rest between games',
      },
      maxGapSlots: {
        name: 'Maximum Gap Slots',
        type: 'number',
        default: 6,
        min: 2,
        max: 20,
        step: 1,
        description: 'Maximum allowed gap between player games in time slots',
      },
    },
  },
  {
    id: 'manage_player_game_balance',
    name: 'Manage player game balance',
    description: 'Limits individual player game counts and ensures fair distribution within divisions.',
    category: 'player',
    priority: 1,
    enabled: true,
    ruleClass: ManagePlayerGameBalance,
    parameters: {
      maxGames: {
        name: 'Maximum Games',
        type: 'number',
        default: 4,
        min: 1,
        max: 15,
        step: 1,
        description: 'Maximum number of games a player can play',
      },
      maxGameDifference: {
        name: 'Max Game Difference',
        type: 'number',
        default: 1,
        min: 0,
        max: 5,
        step: 1,
        description: 'Maximum allowed difference in game count between players',
      },
    },
  },

  // ===== OPTIONAL RULES (Disabled by default) =====
  {
    id: 'warmup_time',
    name: 'Ensure player warm-up time',
    description: 'Ensures players have adequate warm-up time before their first game of the day.',
    category: 'player',
    priority: 1,
    enabled: false,
    ruleClass: EnsurePlayerWarmupTime,
    parameters: {
      minWarmupSlots: {
        name: 'Minimum Warm-up Slots',
        type: 'number',
        default: 1,
        min: 0,
        max: 5,
        step: 1,
        description: 'Minimum time slots before first game for warm-up',
      },
    },
  },
  
  // ===== NEW RULES =====
  {
    id: 'mixed_divisions_timeslot',
    name: 'Detect mixed divisions in time slot',
    description: 'Detects when multiple distinct divisions (mixed/gendered/cloth) are scheduled in the same time slot, which may be undesirable for organization or planning purposes.',
    category: 'both',
    priority: 2,
    enabled: true,
    ruleClass: DetectMixedDivisionsInTimeSlot,
  },
  {
    id: 'club_referee_conflict',
    name: 'Prevent club referee conflict',
    description: 'Prevents teams from refereeing in time slots where another team from the same club is playing, avoiding potential conflicts of interest.',
    category: 'team',
    priority: 3,
    enabled: true,
    ruleClass: PreventClubRefereeConflict,
  },
];

// ===== UTILITY FUNCTIONS =====

/**
 * Get all default rule configurations
 */
export function getDefaultRuleConfigurations(): RuleConfigurationData[] {
  return RULES_REGISTRY.map(rule => ({
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    priority: rule.priority,
    type: 'builtin' as const,
    category: rule.category,
    configuredParams: rule.parameters
      ? Object.fromEntries(Object.entries(rule.parameters).map(([key, param]) => [key, param.default]))
      : undefined,
  }));
}

/**
 * Get rule definition by ID
 */
export function getRuleDefinition(id: string): RuleDefinition | undefined {
  return RULES_REGISTRY.find(rule => rule.id === id);
}

/**
 * Get all team rules (including those that apply to both)
 */
export function getTeamRules(): RuleDefinition[] {
  return RULES_REGISTRY.filter(rule => rule.category === 'team' || rule.category === 'both');
}

/**
 * Get all player rules (including those that apply to both)
 */
export function getPlayerRules(): RuleDefinition[] {
  return RULES_REGISTRY.filter(rule => rule.category === 'player' || rule.category === 'both');
}

/**
 * Create rule instance from configuration
 */
export function createRuleFromConfiguration(config: RuleConfigurationData): ScheduleRule | null {
  if (!config.enabled) return null;

  if (config.type === 'builtin' || config.type === 'duplicated') {
    // For duplicated rules, use the baseRuleId to find the original rule definition
    const ruleId = config.type === 'duplicated' ? config.baseRuleId : config.id;
    const ruleDef = getRuleDefinition(ruleId!);
    if (!ruleDef) {
      console.warn(`Unknown builtin rule: ${ruleId}`);
      return null;
    }

    const args = [config.priority];

    // Add configured parameter values
    if (config.configuredParams && ruleDef.parameters) {
      Object.keys(ruleDef.parameters).forEach(paramName => {
        const configuredValue = config.configuredParams?.[paramName];
        const defaultValue = ruleDef.parameters?.[paramName]?.default;
        args.push(configuredValue !== undefined ? configuredValue : defaultValue);
      });
    } else if (ruleDef.parameters) {
      // Add default values if no configured params
      Object.values(ruleDef.parameters).forEach(param => {
        args.push(param.default);
      });
    }

    try {
      return new ruleDef.ruleClass(...args);
    } catch (err) {
      console.error(`Error creating rule ${config.name}: ${(err as Error).message}`);
      return null;
    }
  } else if (config.type === 'custom' && config.code) {
    try {
      // Convert string function to actual function using eval
      const cleanCode = config.code.replace(/^function\s+evaluate\s*\([^)]*\)\s*{/, '').replace(/}$/, '');
      const evaluateFunc = new Function(
        'schedule',
        'ScheduleHelpers',
        `const violations = [];\n${cleanCode}\nreturn violations;`
      ) as (schedule: any, scheduleHelpers: any) => any[];

      // Wrap the function to provide ScheduleHelpers
      const wrappedFunc = (schedule: any) => evaluateFunc(schedule, ScheduleHelpers);
      return new CustomRuleClass(config.name, wrappedFunc, config.priority);
    } catch (err) {
      console.error(`Error creating custom rule ${config.name}: ${(err as Error).message}`);
      return null;
    }
  }

  return null;
}

/**
 * Migration mapping from old rule IDs to new rule IDs
 */
const RULE_MIGRATION_MAP: { [oldId: string]: string } = {
  'player_back_to_back': 'back_to_back',
  'player_first_last': 'first_last', 
  'limit_team_venue_time': 'limit_venue_time',
  'player_rest_time': 'manage_rest_and_gaps',
  'avoid_large_gaps': 'manage_rest_and_gaps',
  'player_game_limit': 'manage_player_game_balance',
  'balance_game_distribution': 'manage_player_game_balance'
};

/**
 * Migrate old rule configurations to new rule structure
 */
function migrateRuleConfigurations(configs: RuleConfigurationData[]): RuleConfigurationData[] {
  const validRuleIds = new Set(RULES_REGISTRY.map(rule => rule.id));
  const migratedConfigs: RuleConfigurationData[] = [];
  const processedIds = new Set<string>();

  console.log('🔄 Starting rule migration...');

  for (const config of configs) {
    // Skip if rule no longer exists and has no migration
    if (!validRuleIds.has(config.id) && !RULE_MIGRATION_MAP[config.id]) {
      console.log(`❌ Removing obsolete rule: ${config.id}`);
      continue;
    }

    // Migrate if needed
    if (RULE_MIGRATION_MAP[config.id]) {
      const newId = RULE_MIGRATION_MAP[config.id];
      
      // Skip if we've already processed this new ID
      if (processedIds.has(newId)) {
        console.log(`⏭️ Skipping duplicate migration: ${config.id} -> ${newId}`);
        continue;
      }

      const newRule = getRuleDefinition(newId);
      if (newRule) {
        console.log(`🔄 Migrating rule: ${config.id} -> ${newId} (${config.category} -> ${newRule.category})`);
        migratedConfigs.push({
          ...config,
          id: newId,
          name: newRule.name,
          category: newRule.category,
          // Merge parameters from old config if compatible
          configuredParams: config.configuredParams
        });
        processedIds.add(newId);
      }
    } else if (validRuleIds.has(config.id)) {
      // Keep existing valid rules but update their category to match registry
      const ruleDefinition = getRuleDefinition(config.id);
      if (ruleDefinition && ruleDefinition.category !== config.category) {
        console.log(`🔄 Updating category for ${config.id}: ${config.category} -> ${ruleDefinition.category}`);
      }
      migratedConfigs.push({
        ...config,
        category: ruleDefinition?.category || config.category,
        name: ruleDefinition?.name || config.name
      });
      processedIds.add(config.id);
    }
  }

  console.log(`✅ Migration complete. Processed ${migratedConfigs.length} rules.`);
  return migratedConfigs;
}

/**
 * Clean up duplicate rules by removing exact duplicates based on ID
 */
function deduplicateRules(configs: RuleConfigurationData[]): RuleConfigurationData[] {
  const seen = new Map<string, RuleConfigurationData>();
  
  for (const config of configs) {
    if (!seen.has(config.id)) {
      seen.set(config.id, config);
    } else {
      console.log(`🗑️ Removing duplicate rule: ${config.id}`);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Merge existing rule configurations with defaults, adding any new rules and migrating old ones
 */
export function mergeRuleConfigurations(existingConfigs: RuleConfigurationData[]): RuleConfigurationData[] {
  console.log('🔄 Starting rule configuration merge...');
  
  // First migrate any old rule configurations
  const migratedConfigs = migrateRuleConfigurations(existingConfigs);
  
  // Remove duplicates that might have been created during migration
  const deduplicatedConfigs = deduplicateRules(migratedConfigs);
  
  const defaultConfigs = getDefaultRuleConfigurations();
  const existingIds = new Set(deduplicatedConfigs.map(config => config.id));

  // Start with deduplicated migrated configurations
  const mergedConfigs = [...deduplicatedConfigs];

  // Add any new default rules that don't exist in migrated configs
  defaultConfigs.forEach(defaultConfig => {
    if (!existingIds.has(defaultConfig.id)) {
      console.log(`➕ Adding new default rule: ${defaultConfig.id}`);
      mergedConfigs.push(defaultConfig);
    }
  });

  console.log(`✅ Merge complete. Final rule count: ${mergedConfigs.length}`);
  return mergedConfigs;
}

/**
 * Force cleanup of localStorage to remove duplicates and reset to clean state
 * Call this function to manually fix duplicate rule issues
 */
export function cleanupDuplicateRules(): RuleConfigurationData[] {
  console.log('🧹 Starting manual cleanup of duplicate rules...');
  
  // Get fresh defaults only
  const defaultConfigs = getDefaultRuleConfigurations();
  
  console.log(`🗑️ Clearing existing rules and resetting to ${defaultConfigs.length} default rules`);
  console.log('Rules reset:', defaultConfigs.map(r => r.id).join(', '));
  
  return defaultConfigs;
}
