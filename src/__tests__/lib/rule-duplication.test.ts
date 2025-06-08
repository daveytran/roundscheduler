import { createRuleFromConfiguration } from '../../lib/rules-registry';
import { RuleConfigurationData } from '../../lib/localStorage';
import { AvoidBackToBackGames } from '../../models/ScheduleRule';

describe('Rule Duplication', () => {
  test('should create duplicated rule instance with custom priority', () => {
    // Create a duplicated rule configuration
    const duplicatedRuleConfig: RuleConfigurationData = {
      id: 'duplicate_back_to_back_123456789',
      name: 'Avoid back-to-back games (Copy)',
      enabled: true,
      priority: 8, // Different from default priority of 5
      type: 'duplicated',
      category: 'both',
      baseRuleId: 'back_to_back',
      configuredParams: {
        // Use default parameters
      }
    };

    // Create the rule instance
    const rule = createRuleFromConfiguration(duplicatedRuleConfig);

    // Verify the rule was created
    expect(rule).not.toBeNull();
    expect(rule).toBeInstanceOf(AvoidBackToBackGames);
    expect(rule!.priority).toBe(8); // Should use the custom priority
    expect(rule!.name).toBe('Avoid back-to-back games');
  });

  test('should create duplicated rule with custom parameters', () => {
    // Create a duplicated rule configuration for a rule with parameters
    const duplicatedRuleConfig: RuleConfigurationData = {
      id: 'duplicate_player_rest_123456789',
      name: 'Manage rest time and gaps (Copy)',
      enabled: true,
      priority: 3,
      type: 'duplicated',
      category: 'player',
      baseRuleId: 'manage_rest_and_gaps',
      configuredParams: {
        minRestSlots: 3, // Different from default of 2
      }
    };

    // Create the rule instance
    const rule = createRuleFromConfiguration(duplicatedRuleConfig);

    // Verify the rule was created
    expect(rule).not.toBeNull();
    expect(rule!.priority).toBe(3);
  });

  test('should handle invalid baseRuleId gracefully', () => {
    // Create a duplicated rule configuration with invalid base rule
    const invalidDuplicatedRuleConfig: RuleConfigurationData = {
      id: 'duplicate_invalid_123456789',
      name: 'Invalid Duplicated Rule',
      enabled: true,
      priority: 5,
      type: 'duplicated',
      category: 'team',
      baseRuleId: 'nonexistent_rule',
    };

    // Attempt to create the rule instance
    const rule = createRuleFromConfiguration(invalidDuplicatedRuleConfig);

    // Should return null for invalid base rule
    expect(rule).toBeNull();
  });

  test('should create both original and duplicated rules independently', () => {
    // Original rule configuration
    const originalRuleConfig: RuleConfigurationData = {
      id: 'back_to_back',
      name: 'Avoid back-to-back games',
      enabled: true,
      priority: 5, // Original priority
      type: 'builtin',
      category: 'both',
    };

    // Duplicated rule configuration with different priority
    const duplicatedRuleConfig: RuleConfigurationData = {
      id: 'duplicate_back_to_back_123456789',
      name: 'Avoid back-to-back games (Copy)',
      enabled: true,
      priority: 9, // Higher priority
      type: 'duplicated',
      category: 'both',
      baseRuleId: 'back_to_back',
    };

    // Create both rule instances
    const originalRule = createRuleFromConfiguration(originalRuleConfig);
    const duplicatedRule = createRuleFromConfiguration(duplicatedRuleConfig);

    // Both should be created successfully
    expect(originalRule).not.toBeNull();
    expect(duplicatedRule).not.toBeNull();

    // Both should be instances of the same class
    expect(originalRule).toBeInstanceOf(AvoidBackToBackGames);
    expect(duplicatedRule).toBeInstanceOf(AvoidBackToBackGames);

    // But should have different priorities
    expect(originalRule!.priority).toBe(5);
    expect(duplicatedRule!.priority).toBe(9);

    // Names should be the same (from the original rule definition)
    expect(originalRule!.name).toBe('Avoid back-to-back games');
    expect(duplicatedRule!.name).toBe('Avoid back-to-back games');
  });
}); 