import React, { useState, useEffect } from 'react';
import {
  AvoidBackToBackGames,
  AvoidFirstAndLastGame,
  AvoidReffingBeforePlaying,
  AvoidPlayerBackToBackGames,
  EnsurePlayerRestTime,
  LimitPlayerGameCount,
  AvoidPlayerFirstAndLastGame,
  LimitPlayerVenueTime,
  BalancePlayerGameDistribution,
  AvoidPlayerLargeGaps,
  EnsurePlayerWarmupTime,
  BalanceRefereeAssignments,
  EnsureFairFieldDistribution,
  CustomRule as CustomRuleClass,
} from '../models/ScheduleRule';
import { ScheduleHelpers } from '../lib/schedule-helpers';
import { RuleConfigurationData } from '../lib/localStorage';
import CodeEditor from './CodeEditor';

interface RuleConfigurationProps {
  initialConfigurations?: RuleConfigurationData[];
  onConfigurationsChange?: (configs: RuleConfigurationData[]) => void;
  onRulesChange?: (rules: any[]) => void;
}

interface BuiltinRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  type: 'builtin';
  category: 'team' | 'player';
  class: any;
  description: string;
  parameters?: {
    [key: string]: {
      name: string;
      type: 'number' | 'boolean' | 'select';
      default: any;
      min?: number;
      max?: number;
      step?: number;
      options?: { value: any; label: string }[];
      description: string;
    };
  };
  configuredParams?: { [key: string]: any };
}

interface CustomRuleConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  type: 'custom';
  category: 'team' | 'player';
  code: string;
  description?: string;
}

type Rule = BuiltinRule | CustomRuleConfig;

// Helper functions for mapping configurations to rules
const getBuiltinRuleClass = (id: string) => {
  const classMap: { [key: string]: any } = {
    back_to_back: AvoidBackToBackGames,
    first_last: AvoidFirstAndLastGame,
    reffing_before: AvoidReffingBeforePlaying,
    player_back_to_back: AvoidPlayerBackToBackGames,
    player_rest_time: EnsurePlayerRestTime,
    player_game_limit: LimitPlayerGameCount,
    player_first_last: AvoidPlayerFirstAndLastGame,
    limit_venue_time: LimitPlayerVenueTime,
    balance_game_distribution: BalancePlayerGameDistribution,
    avoid_large_gaps: AvoidPlayerLargeGaps,
    warmup_time: EnsurePlayerWarmupTime,
    balance_referee: BalanceRefereeAssignments,
    fair_field_distribution: EnsureFairFieldDistribution,
  };
  return classMap[id];
};

const getBuiltinRuleDescription = (id: string) => {
  const descriptions: { [key: string]: string } = {
    back_to_back:
      'Prevents teams from playing in consecutive time slots, which could cause fatigue and scheduling conflicts.',
    first_last:
      "Ensures teams don't have to stay for the entire event duration by avoiding both the first and last games.",
    reffing_before:
      'Prevents teams from having to referee immediately before their own game, allowing proper warm-up time.',
    player_back_to_back: 'Prevents individual players from playing in consecutive time slots to avoid fatigue.',
    player_rest_time: 'Ensures players have adequate rest time between games (configurable minimum slots).',
    player_game_limit: 'Limits the maximum number of games a player can be scheduled for in a single event.',
    player_first_last: 'Prevents individual players from having to stay for the entire event duration.',
    limit_venue_time: 'Limits the total time players need to be at the venue from their first to last game.',
    balance_game_distribution: 'Ensures fair distribution of games among players within each division.',
    avoid_large_gaps: 'Prevents players from having long waiting periods between their games.',
    warmup_time: 'Ensures players have adequate warm-up time before their first game of the day.',
    balance_referee: 'Distributes referee duties fairly among all teams to ensure equal responsibility.',
    fair_field_distribution: 'Prevents teams from playing too many games on the same field, ensuring variety.',
  };
  return descriptions[id] || '';
};

const getBuiltinRuleParameters = (id: string) => {
  const parameters: { [key: string]: any } = {
    player_rest_time: {
      minRestSlots: {
        name: 'Minimum Rest Slots',
        type: 'number',
        default: 2,
        min: 1,
        max: 10,
        step: 1,
        description: 'Minimum number of time slots players must rest between games',
      },
    },
    player_game_limit: {
      maxGames: {
        name: 'Maximum Games',
        type: 'number',
        default: 4,
        min: 1,
        max: 15,
        step: 1,
        description: 'Maximum number of games a player can play',
      },
    },
    limit_venue_time: {
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
        default: 30,
        min: 15,
        max: 120,
        step: 15,
        description: 'Duration of each time slot in minutes',
      },
    },
    balance_game_distribution: {
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
    avoid_large_gaps: {
      maxGapSlots: {
        name: 'Maximum Gap (slots)',
        type: 'number',
        default: 6,
        min: 2,
        max: 20,
        step: 1,
        description: 'Maximum allowed gap between player games in time slots',
      },
    },
    warmup_time: {
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
    balance_referee: {
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
  };
  return parameters[id];
};

const getDefaultRules = (): Rule[] => [
  // Team-based rules (higher priority)
  {
    id: 'back_to_back',
    name: 'Avoid back-to-back games (Teams)',
    enabled: true,
    priority: 5,
    type: 'builtin',
    category: 'team',
    class: AvoidBackToBackGames,
    description: getBuiltinRuleDescription('back_to_back'),
  },
  {
    id: 'first_last',
    name: 'Avoid teams having first and last game',
    enabled: true,
    priority: 4,
    type: 'builtin',
    category: 'team',
    class: AvoidFirstAndLastGame,
    description: getBuiltinRuleDescription('first_last'),
  },
  {
    id: 'reffing_before',
    name: 'Avoid teams reffing before playing',
    enabled: true,
    priority: 4,
    type: 'builtin',
    category: 'team',
    class: AvoidReffingBeforePlaying,
    description: getBuiltinRuleDescription('reffing_before'),
  },
  {
    id: 'balance_referee',
    name: 'Balance referee assignments',
    enabled: true,
    priority: 3,
    type: 'builtin',
    category: 'team',
    class: BalanceRefereeAssignments,
    description: getBuiltinRuleDescription('balance_referee'),
    parameters: getBuiltinRuleParameters('balance_referee'),
  },
  {
    id: 'fair_field_distribution',
    name: 'Ensure fair field distribution',
    enabled: true,
    priority: 2,
    type: 'builtin',
    category: 'team',
    class: EnsureFairFieldDistribution,
    description: getBuiltinRuleDescription('fair_field_distribution'),
  },
  // Player-based rules (lower priority)
  {
    id: 'player_back_to_back',
    name: 'Avoid back-to-back games (Players)',
    enabled: true,
    priority: 2,
    type: 'builtin',
    category: 'player',
    class: AvoidPlayerBackToBackGames,
    description: getBuiltinRuleDescription('player_back_to_back'),
  },
  {
    id: 'limit_venue_time',
    name: 'Limit player venue time',
    enabled: true,
    priority: 2,
    type: 'builtin',
    category: 'player',
    class: LimitPlayerVenueTime,
    description: getBuiltinRuleDescription('limit_venue_time'),
    parameters: getBuiltinRuleParameters('limit_venue_time'),
  },
  {
    id: 'player_rest_time',
    name: 'Ensure player rest time',
    enabled: true,
    priority: 1,
    type: 'builtin',
    category: 'player',
    class: EnsurePlayerRestTime,
    description: getBuiltinRuleDescription('player_rest_time'),
    parameters: getBuiltinRuleParameters('player_rest_time'),
  },
  {
    id: 'player_first_last',
    name: 'Avoid players having first and last game',
    enabled: true,
    priority: 1,
    type: 'builtin',
    category: 'player',
    class: AvoidPlayerFirstAndLastGame,
    description: getBuiltinRuleDescription('player_first_last'),
  },
  {
    id: 'avoid_large_gaps',
    name: 'Avoid large gaps between player games',
    enabled: true,
    priority: 1,
    type: 'builtin',
    category: 'player',
    class: AvoidPlayerLargeGaps,
    description: getBuiltinRuleDescription('avoid_large_gaps'),
    parameters: getBuiltinRuleParameters('avoid_large_gaps'),
  },
  {
    id: 'player_game_limit',
    name: 'Limit player game count',
    enabled: false,
    priority: 1,
    type: 'builtin',
    category: 'player',
    class: LimitPlayerGameCount,
    description: getBuiltinRuleDescription('player_game_limit'),
    parameters: getBuiltinRuleParameters('player_game_limit'),
  },
  {
    id: 'balance_game_distribution',
    name: 'Balance player game distribution',
    enabled: false,
    priority: 1,
    type: 'builtin',
    category: 'player',
    class: BalancePlayerGameDistribution,
    description: getBuiltinRuleDescription('balance_game_distribution'),
    parameters: getBuiltinRuleParameters('balance_game_distribution'),
  },
  {
    id: 'warmup_time',
    name: 'Ensure player warm-up time',
    enabled: false,
    priority: 1,
    type: 'builtin',
    category: 'player',
    class: EnsurePlayerWarmupTime,
    description: getBuiltinRuleDescription('warmup_time'),
    parameters: getBuiltinRuleParameters('warmup_time'),
  },
];

export default function RuleConfiguration({
  initialConfigurations,
  onConfigurationsChange,
  onRulesChange,
}: RuleConfigurationProps) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [customRuleName, setCustomRuleName] = useState('');
  const [customRuleCode, setCustomRuleCode] = useState<string>(
    'function evaluate(schedule) {\n  const violations = [];\n  // Your custom rule logic here\n  return violations;\n}'
  );
  const [customRulePriority, setCustomRulePriority] = useState(2);
  const [customRuleCategory, setCustomRuleCategory] = useState<'team' | 'player'>('team');
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<(CustomRuleConfig & { originalId: string }) | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load initial configurations or use defaults (only once)
  useEffect(() => {
    if (!isInitialized) {
      if (initialConfigurations && initialConfigurations.length > 0) {
        // Convert RuleConfigurationData to Rule format
        const convertedRules = initialConfigurations.map(config => {
          const baseRule = {
            id: config.id,
            name: config.name,
            enabled: config.enabled,
            priority: config.priority,
            type: config.type,
            category: config.category,
          };

          if (config.type === 'builtin') {
            return {
              ...baseRule,
              class: getBuiltinRuleClass(config.id),
              description: getBuiltinRuleDescription(config.id),
              parameters: getBuiltinRuleParameters(config.id),
              configuredParams: config.configuredParams,
            } as BuiltinRule;
          } else {
            return {
              ...baseRule,
              code:
                config.code ||
                'function evaluate(schedule) {\n  const violations = [];\n  // Your custom rule logic here\n  return violations;\n}',
            } as CustomRuleConfig;
          }
        });

        setRules(convertedRules);
      } else {
        // Use default rules
        setRules(getDefaultRules());
      }
      setIsInitialized(true);
    }
  }, [initialConfigurations, isInitialized]); // Prevent circular updates by only initializing once

  // Convert Rule[] to RuleConfigurationData[] and notify parent when rules change
  useEffect(() => {
    const configurations: RuleConfigurationData[] = rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      priority: rule.priority,
      type: rule.type,
      category: rule.category,
      configuredParams: rule.type === 'builtin' ? rule.configuredParams : undefined,
      code: rule.type === 'custom' ? rule.code : undefined,
    }));

    if (onConfigurationsChange) {
      onConfigurationsChange(configurations);
    }
  }, [rules, onConfigurationsChange]);

  // Create rule instances and notify parent when configurations change
  useEffect(() => {
    if (onRulesChange) {
      const enabledRules = rules
        .filter(rule => rule.enabled)
        .map(rule => {
          try {
            if (rule.type === 'builtin') {
              if (!rule.class) {
                console.error(`Built-in rule ${rule.name} has no class defined`);
                return null;
              }

              // Build constructor arguments based on parameters
              const args = [rule.priority];
              if (rule.parameters && rule.configuredParams) {
                // Add configured parameter values in the order they appear in the parameters definition
                Object.keys(rule.parameters).forEach(paramName => {
                  const configuredValue = rule.configuredParams?.[paramName];
                  const defaultValue = rule.parameters?.[paramName]?.default;
                  args.push(configuredValue !== undefined ? configuredValue : defaultValue);
                });
              } else if (rule.parameters) {
                // Add default values if no configured params
                Object.values(rule.parameters).forEach(param => {
                  args.push(param.default);
                });
              }

              const ruleInstance = new rule.class(...args);
              if (typeof ruleInstance.evaluate !== 'function') {
                console.error(`Built-in rule ${rule.name} has no evaluate method`);
                return null;
              }
              return ruleInstance;
            } else if (rule.type === 'custom') {
              try {
                // Convert string function to actual function using eval
                const cleanCode = rule.code.replace(/^function\s+evaluate\s*\([^)]*\)\s*{/, '').replace(/}$/, '');
                const evaluateFunc = new Function(
                  'schedule',
                  'ScheduleHelpers',
                  `const violations = [];\n${cleanCode}\nreturn violations;`
                ) as (schedule: any, scheduleHelpers: any) => any[];

                // Wrap the function to provide ScheduleHelpers
                const wrappedFunc = (schedule: any) => evaluateFunc(schedule, ScheduleHelpers);
                return new CustomRuleClass(rule.name, wrappedFunc, rule.priority);
              } catch (err) {
                console.error(`Error creating custom rule ${rule.name}: ${(err as Error).message}`);
                return null;
              }
            }
          } catch (err) {
            console.error(`Error creating rule ${rule.name}: ${(err as Error).message}`);
            return null;
          }
          return null;
        })
        .filter(rule => rule !== null);

      onRulesChange(enabledRules);
    }
  }, [rules, onRulesChange]);

  const handleParameterChange = (ruleId: string, paramName: string, value: any) => {
    setRules(
      rules.map(rule => {
        if (rule.id === ruleId && rule.type === 'builtin') {
          return {
            ...rule,
            configuredParams: {
              ...rule.configuredParams,
              [paramName]: value,
            },
          };
        }
        return rule;
      })
    );
  };

  const handleToggleRule = (id: string) => {
    setRules(rules.map(rule => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)));
  };

  const handlePriorityChange = (id: string, value: string) => {
    const priority = parseInt(value);
    if (isNaN(priority) || priority < 1 || priority > 10) return;

    setRules(rules.map(rule => (rule.id === id ? { ...rule, priority } : rule)));
  };

  const handleAddCustomRule = () => {
    try {
      setError(null);

      if (!customRuleName.trim()) {
        setError('Please enter a name for the custom rule');
        return;
      }

      // Test if the code is valid JavaScript
      try {
        eval(`function evaluate(schedule) {
          ${customRuleCode}
          }`);
      } catch (err) {
        setError(`Invalid JavaScript: ${(err as Error).message}`);
        return;
      }

      // Create new rule
      const newRule = {
        id: `custom_${Date.now()}`,
        name: customRuleName,
        enabled: true,
        priority: customRulePriority,
        type: 'custom',
        category: customRuleCategory,
        code: customRuleCode,
      } satisfies CustomRuleConfig;

      setRules([...rules, newRule]);

      // Reset form
      setCustomRuleName('');
      setCustomRuleCode(
        'function evaluate(schedule) {\n  const violations = [];\n  // Your custom rule logic here\n  return violations;\n}'
      );
      setCustomRulePriority(customRuleCategory === 'team' ? 3 : 2);
    } catch (err) {
      setError(`Error adding custom rule: ${(err as Error).message}`);
    }
  };

  const handleRemoveRule = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id));
  };

  const handleEditRule = (rule: CustomRuleConfig) => {
    setEditingRule({
      ...rule,
      originalId: rule.id,
    });
    setCustomRuleName(rule.name);
    setCustomRuleCode(rule.code);
    setCustomRulePriority(rule.priority);
    setCustomRuleCategory(rule.category);
  };

  const handleSaveEdit = () => {
    try {
      setError(null);

      if (!customRuleName.trim()) {
        setError('Please enter a name for the rule');
        return;
      }

      // Test if the code is valid JavaScript
      try {
        eval(`function evaluate(schedule) {
          ${customRuleCode}
          }`);
      } catch (err) {
        setError(`Invalid JavaScript: ${(err as Error).message}`);
        return;
      }

      // Update the rule
      setRules(
        rules.map(rule =>
          rule.id === editingRule?.originalId
            ? {
                ...rule,
                name: customRuleName,
                code: customRuleCode ?? '',
                priority: customRulePriority,
                category: customRuleCategory,
              }
            : rule
        )
      );

      // Reset form and editing state
      setEditingRule(null);
      setCustomRuleName('');
      setCustomRuleCode(
        'function evaluate(schedule) {\n  const violations = [];\n  // Your custom rule logic here\n  return violations;\n}'
      );
      setCustomRulePriority(2);
      setCustomRuleCategory('team');
    } catch (err) {
      setError(`Error updating rule: ${(err as Error).message}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
    setCustomRuleName('');
    setCustomRuleCode(
      'function evaluate(schedule) {\n  const violations = [];\n  // Your custom rule logic here\n  return violations;\n}'
    );
    setCustomRulePriority(2);
    setCustomRuleCategory('team');
    setError(null);
  };

  // Separate rules by category
  const teamRules = rules.filter(rule => rule.category === 'team');
  const playerRules = rules.filter(rule => rule.category === 'player');

  const getCategoryColor = (category: 'team' | 'player') => {
    return category === 'team' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
  };

  const renderParameterControl = (rule: BuiltinRule, paramName: string, param: any) => {
    const value = rule.configuredParams?.[paramName] ?? param.default;

    switch (param.type) {
      case 'number':
        return (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 min-w-0">{param.name}:</label>
            <input
              type="number"
              value={value}
              onChange={e => handleParameterChange(rule.id, paramName, parseFloat(e.target.value))}
              min={param.min}
              max={param.max}
              step={param.step}
              className="w-16 p-1 border rounded text-xs text-center"
              title={param.description}
            />
          </div>
        );
      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value}
              onChange={e => handleParameterChange(rule.id, paramName, e.target.checked)}
              className="rounded"
            />
            <label className="text-xs text-gray-600">{param.name}</label>
          </div>
        );
      case 'select':
        return (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">{param.name}:</label>
            <select
              value={value}
              onChange={e => handleParameterChange(rule.id, paramName, e.target.value)}
              className="text-xs p-1 border rounded"
              title={param.description}
            >
              {param.options?.map((option: { value: any; label: string }) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );
      default:
        return null;
    }
  };

  const renderRuleSection = (title: string, sectionRules: Rule[], category: 'team' | 'player') => (
    <div className="mb-6">
      <h3 className="font-bold mb-3 text-lg">{title}</h3>
      <div className="space-y-4">
        {sectionRules.map(rule => (
          <div key={rule.id} className="border rounded-lg bg-gray-50">
            <div className="flex items-start justify-between p-3">
              <div className="flex items-start">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => handleToggleRule(rule.id)}
                  className="mr-3 mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-medium ${!rule.enabled ? 'text-gray-400' : ''}`}>{rule.name}</span>
                    {rule.type === 'builtin' && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Built-in</span>
                    )}
                    {rule.type === 'custom' && (
                      <span className={`px-2 py-1 rounded text-xs ${getCategoryColor(rule.category)}`}>
                        Custom {rule.category}
                      </span>
                    )}
                  </div>
                  {rule.description && <p className="text-sm text-gray-600 mb-2">{rule.description}</p>}

                  {/* Parameter Controls */}
                  {rule.type === 'builtin' && rule.parameters && Object.keys(rule.parameters).length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-2">
                      {Object.entries(rule.parameters).map(([paramName, param]) => (
                        <div key={paramName}>{renderParameterControl(rule, paramName, param)}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <label className="text-sm text-gray-600">Priority:</label>
                <input
                  type="number"
                  value={rule.priority}
                  onChange={e => handlePriorityChange(rule.id, e.target.value)}
                  min="1"
                  max="10"
                  className="w-16 p-1 border rounded text-center"
                />

                {rule.type === 'custom' && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditRule(rule)}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                      disabled={editingRule?.originalId === rule.id}
                    >
                      {editingRule?.originalId === rule.id ? 'Editing...' : 'Edit'}
                    </button>
                    <button
                      onClick={() => handleRemoveRule(rule.id)}
                      className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">🎯 Scheduling Rules</h2>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">
              Configure rules and their priorities. Higher priority rules (1-10) will be satisfied first.
            </p>
            <p className="text-xs text-gray-500">
              <strong>Team rules</strong> focus on team-level constraints and have higher default priorities.
              <strong className="ml-2">Player rules</strong> focus on individual player constraints and have lower
              priorities.
            </p>
          </div>
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
          >
            {showExamples ? 'Hide' : 'Show'} Examples
          </button>
        </div>

        {/* Enhanced Features Info */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">✨ Enhanced Features</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>
              <strong>💾 Auto-Save:</strong> Your rule configurations are automatically saved to your browser and
              restored when you return.
            </p>
            <p>
              <strong>⚙️ Configurable Parameters:</strong> Many rules have adjustable settings (like max hours, gap
              slots, etc.) that you can customize.
            </p>
            <p>
              <strong>🎯 Smart Defaults:</strong> All parameters come with sensible defaults based on common scheduling
              needs.
            </p>
          </div>
        </div>

        {/* Team Rules Section */}
        {renderRuleSection('🏆 Team Rules (Higher Priority)', teamRules, 'team')}

        {/* Player Rules Section */}
        {renderRuleSection('👤 Player Rules (Lower Priority)', playerRules, 'player')}
      </div>

      <div className="border-t pt-4">
        <h3 className="font-bold mb-3">
          {editingRule ? `✏️ Edit Custom Rule: ${editingRule.name}` : '➕ Add Custom Rule'}
        </h3>

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
          <input
            type="text"
            value={customRuleName}
            onChange={e => setCustomRuleName(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="e.g., Avoid same team on same field twice"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={customRuleCategory}
              onChange={e => {
                setCustomRuleCategory(e.target.value as 'team' | 'player');
                setCustomRulePriority(e.target.value === 'team' ? 3 : 2);
              }}
              className="w-full p-2 border rounded"
            >
              <option value="team">Team Rule (Higher Priority)</option>
              <option value="player">Player Rule (Lower Priority)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority (1-10)</label>
            <input
              type="number"
              value={customRulePriority}
              onChange={e => setCustomRulePriority(parseInt(e.target.value))}
              min="1"
              max="10"
              className="w-full p-2 border rounded"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rule Logic (TypeScript with IntelliSense)
          </label>
          <CodeEditor value={customRuleCode} onChange={setCustomRuleCode} height="400px" />
        </div>

        <div className="flex gap-2">
          {editingRule ? (
            <>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                💾 Save Changes
              </button>
              <button onClick={handleCancelEdit} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                ❌ Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleAddCustomRule}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              ➕ Add Custom {customRuleCategory === 'team' ? 'Team' : 'Player'} Rule
            </button>
          )}
        </div>

        {error && <div className="p-2 mt-3 bg-red-100 border border-red-300 text-red-500 rounded">{error}</div>}
      </div>
    </div>
  );
}
