import React, { useState, useEffect } from 'react';
import { CustomRuleDefinitionData, RuleCategory, RuleConfigurationData } from '../lib/localStorage';
import {
  RULES_REGISTRY,
  RuleDefinition,
  getRuleDefinition,
  createRuleFromConfiguration,
} from '../lib/rules-registry';
import {
  createCustomRuleDefinition,
  DEFAULT_CUSTOM_RULE_TEMPLATE,
  validateCustomRuleSource,
} from '../lib/custom-rule-engine';
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
  category: RuleCategory;
  class: any;
  description: string;
  parameters?: { [key: string]: any };
  configuredParams?: { [key: string]: any };
}

interface CustomRuleConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  type: 'custom';
  category: RuleCategory;
  code: string;
  customDefinition: CustomRuleDefinitionData;
  description?: string;
}

interface DuplicatedRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  type: 'duplicated';
  category: RuleCategory;
  class: any;
  description: string;
  parameters?: { [key: string]: any };
  configuredParams?: { [key: string]: any };
  baseRuleId: string; // ID of the original built-in rule
}

type Rule = BuiltinRule | CustomRuleConfig | DuplicatedRule;

// Convert RuleDefinition to BuiltinRule format
const convertRuleDefinitionToBuiltinRule = (
  ruleDef: RuleDefinition,
  enabled: boolean,
  priority: number,
  configuredParams?: any
): BuiltinRule => ({
  id: ruleDef.id,
  name: ruleDef.name,
  enabled,
  priority,
  type: 'builtin',
  category: ruleDef.category,
  class: ruleDef.ruleClass,
  description: ruleDef.description,
  parameters: ruleDef.parameters,
  configuredParams,
});

// Get default rules from registry
const getDefaultRules = (): Rule[] =>
  RULES_REGISTRY.map(ruleDef =>
    convertRuleDefinitionToBuiltinRule(
      ruleDef,
      ruleDef.enabled,
      ruleDef.priority,
      ruleDef.parameters
        ? Object.fromEntries(Object.entries(ruleDef.parameters).map(([key, param]) => [key, param.default]))
        : undefined
    )
  );

const convertConfigurationsToRules = (configurations: RuleConfigurationData[]): Rule[] =>
  configurations.map(config => {
    const baseRule = {
      id: config.id,
      name: config.name,
      enabled: config.enabled,
      priority: config.priority,
      type: config.type,
      category: config.category,
    };

    if (config.type === 'builtin') {
      const ruleDef = getRuleDefinition(config.id);
      return {
        ...baseRule,
        class: ruleDef?.ruleClass,
        description: ruleDef?.description || '',
        parameters: ruleDef?.parameters,
        configuredParams: config.configuredParams,
      } as BuiltinRule;
    }

    if (config.type === 'duplicated') {
      const ruleDef = getRuleDefinition(config.baseRuleId!);
      return {
        ...baseRule,
        class: ruleDef?.ruleClass,
        description: ruleDef?.description || '',
        parameters: ruleDef?.parameters,
        configuredParams: config.configuredParams,
        baseRuleId: config.baseRuleId!,
      } as DuplicatedRule;
    }

    const customDefinition = createCustomRuleDefinition(
      config.customDefinition?.source ?? config.code ?? DEFAULT_CUSTOM_RULE_TEMPLATE,
      config.customDefinition
    );

    return {
      ...baseRule,
      code: customDefinition.source,
      customDefinition,
    } as CustomRuleConfig;
  });

const convertRulesToConfigurations = (rules: Rule[]): RuleConfigurationData[] =>
  rules.map(rule => {
    if (rule.type === 'custom') {
      const customDefinition = createCustomRuleDefinition(rule.code, rule.customDefinition);
      return {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        priority: rule.priority,
        type: rule.type,
        category: rule.category,
        customDefinition,
        code: customDefinition.source,
      };
    }

    return {
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      priority: rule.priority,
      type: rule.type,
      category: rule.category,
      configuredParams: rule.configuredParams,
      baseRuleId: rule.type === 'duplicated' ? rule.baseRuleId : undefined,
    };
  });

const getConfigurationsSignature = (configs?: RuleConfigurationData[]): string => {
  if (!configs) return '[]';
  return JSON.stringify(
    configs.map(config => ({
      id: config.id,
      name: config.name,
      enabled: config.enabled,
      priority: config.priority,
      type: config.type,
      category: config.category,
      configuredParams: config.configuredParams || null,
      customDefinition: config.customDefinition || null,
      code: config.code || null,
      baseRuleId: config.baseRuleId || null,
    }))
  );
};

export default function RuleConfiguration({
  initialConfigurations,
  onConfigurationsChange,
  onRulesChange,
}: RuleConfigurationProps) {
  const [rules, setRules] = useState<Rule[]>(
    initialConfigurations && initialConfigurations.length > 0
      ? convertConfigurationsToRules(initialConfigurations)
      : getDefaultRules()
  );
  const [customRuleName, setCustomRuleName] = useState('');
  const [customRuleCode, setCustomRuleCode] = useState<string>(DEFAULT_CUSTOM_RULE_TEMPLATE);
  const [customRulePriority, setCustomRulePriority] = useState(2);
  const [customRuleCategory, setCustomRuleCategory] = useState<RuleCategory>('team');
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<(CustomRuleConfig & { originalId: string }) | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  const resetCustomRuleForm = (priority: number = 2, category: RuleCategory = 'team') => {
    setCustomRuleName('');
    setCustomRuleCode(DEFAULT_CUSTOM_RULE_TEMPLATE);
    setCustomRulePriority(priority);
    setCustomRuleCategory(category);
  };

  // Keep local rule state in sync with parent-provided configurations.
  useEffect(() => {
    const nextRules =
      initialConfigurations && initialConfigurations.length > 0
        ? convertConfigurationsToRules(initialConfigurations)
        : getDefaultRules();

    setRules(prevRules => {
      const prevSignature = getConfigurationsSignature(convertRulesToConfigurations(prevRules));
      const nextSignature = getConfigurationsSignature(convertRulesToConfigurations(nextRules));
      return prevSignature === nextSignature ? prevRules : nextRules;
    });
  }, [initialConfigurations]);

  // Convert Rule[] to RuleConfigurationData[] and notify parent when rules change
  useEffect(() => {
    const configurations = convertRulesToConfigurations(rules);

    if (onConfigurationsChange) {
      const localSignature = getConfigurationsSignature(configurations);
      const propSignature = getConfigurationsSignature(initialConfigurations);
      if (localSignature !== propSignature) {
        onConfigurationsChange(configurations);
      }
    }
  }, [rules, onConfigurationsChange, initialConfigurations]);

  // Create rule instances and notify parent when configurations change
  useEffect(() => {
    if (onRulesChange) {
      const configurations = convertRulesToConfigurations(rules);

      const enabledRules = configurations
        .filter(config => config.enabled)
        .map(config => createRuleFromConfiguration(config))
        .filter(rule => rule !== null);

      onRulesChange(enabledRules);
    }
  }, [rules, onRulesChange]);

  const handleParameterChange = (ruleId: string, paramName: string, value: any) => {
    setRules(
      rules.map(rule => {
        if (rule.id === ruleId && (rule.type === 'builtin' || rule.type === 'duplicated')) {
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

      const validation = validateCustomRuleSource(customRuleCode);
      if (!validation.valid) {
        setError(`Invalid custom rule: ${validation.error}`);
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
        code: validation.definition.source,
        customDefinition: validation.definition,
      } satisfies CustomRuleConfig;

      setRules([...rules, newRule]);

      // Reset form
      resetCustomRuleForm(customRuleCategory === 'team' ? 3 : 2, customRuleCategory);
    } catch (err) {
      setError(`Error adding custom rule: ${(err as Error).message}`);
    }
  };

  const handleRemoveRule = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id));
  };

  const handleDuplicateRule = (rule: BuiltinRule) => {
    const duplicatedRule: DuplicatedRule = {
      id: `duplicate_${rule.id}_${Date.now()}`,
      name: `${rule.name} (Copy)`,
      enabled: true,
      priority: rule.priority,
      type: 'duplicated',
      category: rule.category,
      class: rule.class,
      description: rule.description,
      parameters: rule.parameters,
      configuredParams: { ...rule.configuredParams }, // Copy current parameter values
      baseRuleId: rule.id,
    };

    setRules([...rules, duplicatedRule]);
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

      const validation = validateCustomRuleSource(customRuleCode, editingRule?.customDefinition);
      if (!validation.valid) {
        setError(`Invalid custom rule: ${validation.error}`);
        return;
      }

      // Update the rule
      setRules(
        rules.map(rule =>
          rule.id === editingRule?.originalId
            ? {
                ...rule,
                name: customRuleName,
                code: validation.definition.source,
                customDefinition: validation.definition,
                priority: customRulePriority,
                category: customRuleCategory,
              }
            : rule
        )
      );

      // Reset form and editing state
      setEditingRule(null);
      resetCustomRuleForm();
    } catch (err) {
      setError(`Error updating rule: ${(err as Error).message}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
    resetCustomRuleForm();
    setError(null);
  };

  // Sort all rules by priority (highest first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  const getCategoryColor = (category: RuleCategory) => {
    switch (category) {
      case 'team':
        return 'bg-blue-100 text-blue-700';
      case 'player':
        return 'bg-purple-100 text-purple-700';
      case 'both':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const renderParameterControl = (rule: BuiltinRule | DuplicatedRule, paramName: string, param: any) => {
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

  const renderRuleSection = (title: string, sectionRules: Rule[]) => (
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
                    
                    {/* Category Badge */}
                    <span className={`px-2 py-1 rounded text-xs ${getCategoryColor(rule.category)}`}>
                      {rule.category === 'both' ? 'Teams & Players' : rule.category === 'team' ? 'Teams' : 'Players'}
                    </span>
                    
                    {/* Type Badge */}
                    {rule.type === 'builtin' && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Built-in</span>
                    )}
                    {rule.type === 'duplicated' && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">Duplicated</span>
                    )}
                    {rule.type === 'custom' && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">Custom</span>
                    )}
                  </div>
                  {rule.description && <p className="text-sm text-gray-600 mb-2">{rule.description}</p>}

                  {/* Parameter Controls */}
                  {(rule.type === 'builtin' || rule.type === 'duplicated') && rule.parameters && Object.keys(rule.parameters).length > 0 && (
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

                <div className="flex gap-1">
                  {rule.type === 'builtin' && (
                    <button
                      onClick={() => handleDuplicateRule(rule)}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                      title="Create a copy with custom priority/parameters"
                    >
                      Duplicate
                    </button>
                  )}
                  {rule.type === 'custom' && (
                    <button
                      onClick={() => handleEditRule(rule)}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                      disabled={editingRule?.originalId === rule.id}
                    >
                      {editingRule?.originalId === rule.id ? 'Editing...' : 'Edit'}
                    </button>
                  )}
                  {(rule.type === 'custom' || rule.type === 'duplicated') && (
                    <button
                      onClick={() => handleRemoveRule(rule.id)}
                      className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
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
              Rules are sorted by priority (highest first). <strong>Team rules</strong> focus on team-level constraints, 
              <strong> Player rules</strong> focus on individual constraints, and <strong> Combined rules</strong> apply to both teams and players.
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
            <p>
              <strong>📋 Rule Duplication:</strong> Duplicate built-in rules to create multiple versions with different priorities and parameters.
            </p>
          </div>
        </div>

        {/* All Rules Section */}
        {renderRuleSection('⚙️ Scheduling Rules', sortedRules)}
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
                setCustomRuleCategory(e.target.value as RuleCategory);
                setCustomRulePriority(e.target.value === 'team' ? 4 : e.target.value === 'both' ? 3 : 2);
              }}
              className="w-full p-2 border rounded"
            >
              <option value="team">Team Rule</option>
              <option value="both">Combined Rule (Teams & Players)</option>
              <option value="player">Player Rule</option>
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
              ➕ Add Custom Rule
            </button>
          )}
        </div>

        {error && <div className="p-2 mt-3 bg-red-100 border border-red-300 text-red-500 rounded">{error}</div>}
      </div>
    </div>
  );
}
