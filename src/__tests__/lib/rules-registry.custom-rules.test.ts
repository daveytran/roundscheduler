import { RuleConfigurationData } from '../../lib/localStorage';
import { createRuleFromConfiguration, mergeRuleConfigurations } from '../../lib/rules-registry';
import { testScenarios } from '../../lib/testUtils';
import { Schedule } from '../../models/Schedule';

describe('rules-registry custom rules', () => {
  it('creates custom rules from legacy function source and normalizes legacy severity', () => {
    const config: RuleConfigurationData = {
      id: 'custom_legacy_1',
      name: 'Legacy Custom Rule',
      enabled: true,
      priority: 4,
      type: 'custom',
      category: 'team',
      code: `
function evaluate(schedule) {
  return [
    {
      description: "Legacy severity output",
      severity: "high"
    }
  ];
}`,
    };

    const rule = createRuleFromConfiguration(config);
    expect(rule).not.toBeNull();

    const schedule = new Schedule(testScenarios.validSchedule());
    const score = schedule.evaluate([rule!]);

    expect(score).toBe(4);
    expect(schedule.violations).toHaveLength(1);
    expect(schedule.violations[0].rule).toBe('Legacy Custom Rule');
    expect(schedule.violations[0].description).toBe('Legacy severity output');
    expect(schedule.violations[0].level).toBe('alert');
  });

  it('supports structured body-based custom rule definitions', () => {
    const config: RuleConfigurationData = {
      id: 'custom_structured_1',
      name: 'Structured Custom Rule',
      enabled: true,
      priority: 3,
      type: 'custom',
      category: 'player',
      customDefinition: {
        engine: 'javascript',
        version: 1,
        sourceType: 'body',
        source: `
violations.push({
  description: "Body custom rule output",
  level: "critical"
});
`,
      },
    };

    const rule = createRuleFromConfiguration(config);
    expect(rule).not.toBeNull();

    const schedule = new Schedule(testScenarios.validSchedule());
    const score = schedule.evaluate([rule!]);

    expect(score).toBe(3);
    expect(schedule.violations).toHaveLength(1);
    expect(schedule.violations[0].rule).toBe('Structured Custom Rule');
    expect(schedule.violations[0].level).toBe('critical');
  });

  it('preserves custom and duplicated rules during merge', () => {
    const existingConfigs: RuleConfigurationData[] = [
      {
        id: 'back_to_back',
        name: 'Avoid back-to-back games',
        enabled: true,
        priority: 7,
        type: 'builtin',
        category: 'team',
      },
      {
        id: 'custom_keep_me',
        name: 'Keep me',
        enabled: true,
        priority: 2,
        type: 'custom',
        category: 'team',
        customDefinition: {
          engine: 'javascript',
          version: 1,
          sourceType: 'evaluate-function',
          source: 'function evaluate(schedule) { return []; }',
        },
      },
      {
        id: 'duplicate_back_to_back_1',
        name: 'Avoid back-to-back games (Copy)',
        enabled: true,
        priority: 9,
        type: 'duplicated',
        category: 'team',
        baseRuleId: 'back_to_back',
      },
    ];

    const merged = mergeRuleConfigurations(existingConfigs);

    const custom = merged.find(config => config.id === 'custom_keep_me');
    const duplicated = merged.find(config => config.id === 'duplicate_back_to_back_1');
    const builtin = merged.find(config => config.id === 'back_to_back');

    expect(custom).toBeDefined();
    expect(custom?.type).toBe('custom');
    expect(custom?.customDefinition?.source).toContain('function evaluate');

    expect(duplicated).toBeDefined();
    expect(duplicated?.type).toBe('duplicated');
    expect(duplicated?.baseRuleId).toBe('back_to_back');
    expect(duplicated?.category).toBe('both');

    expect(builtin?.category).toBe('both');
    expect(merged.some(config => config.id === 'prevent_team_double_booking')).toBe(true);
  });
});
