import React, { useState, useEffect } from 'react';
import {
  AvoidBackToBackGames,
  AvoidFirstAndLastGame,
  AvoidReffingBeforePlaying,
  CustomRule as CustomRuleClass,
} from '../models/ScheduleRule';
import CodeEditor from './CodeEditor';

interface RuleConfigurationProps {
  onRulesChange?: (rules: any[]) => void;
}

interface BuiltinRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  type: 'builtin';
  class: any;
}

interface CustomRuleConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  type: 'custom';
  /**
   * Function body assuming the parameter is a schedule and violations to push to
   * Example:
   * ```
   * schedule.matches
   * 
   * violations.push({
   *   rule: "Avoid back-to-back games",
   *   description: "Team plays back-to-back in time slots 1 and 2",
   *   matches: [schedule.matches[0], schedule.matches[1]]
   * });
   * 
   * return violations;
   * ```
   */
  code: string;
}

type Rule = BuiltinRule | CustomRuleConfig;

export default function RuleConfiguration({ onRulesChange }: RuleConfigurationProps) {
  const [rules, setRules] = useState<Rule[]>([
    {
      id: 'back_to_back',
      name: 'Avoid back-to-back games',
      enabled: true,
      priority: 5,
      type: 'builtin',
      class: AvoidBackToBackGames,
    },
    {
      id: 'first_last',
      name: 'Avoid teams having first and last game',
      enabled: true,
      priority: 3,
      type: 'builtin',
      class: AvoidFirstAndLastGame,
    },
    {
      id: 'reffing_before',
      name: 'Avoid teams reffing before playing',
      enabled: true,
      priority: 4,
      type: 'builtin',
      class: AvoidReffingBeforePlaying,
    },
  ]);

  const [customRuleName, setCustomRuleName] = useState('');
  const [customRuleCode, setCustomRuleCode] = useState<string>();
  const [customRulePriority, setCustomRulePriority] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<(CustomRuleConfig & { originalId: string }) | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  // Notify parent component when rules change
  useEffect(() => {
    if (onRulesChange) {
      const enabledRules = rules
        .filter(rule => rule.enabled)
        .map(rule => {
          if (rule.type === 'builtin') {
            return new rule.class(rule.priority);
          } else if (rule.type === 'custom') {
            try {
              // Convert string function to actual function using eval
              const evaluateFunc = (schedule: any) => {
                eval(rule.code);
                // @ts-ignore - evaluate function is defined by eval
                return evaluate(schedule);
              };
              return new CustomRuleClass(rule.name, evaluateFunc, rule.priority);
            } catch (err) {
              console.error(`Error creating custom rule: ${(err as Error).message}`);
              return null;
            }
          }
          return null;
        })
        .filter(rule => rule !== null);

      onRulesChange(enabledRules);
    }
  }, [rules, onRulesChange]);

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
        code: `function evaluate(schedule) {
          ${customRuleCode}
          }`,
      } satisfies CustomRuleConfig;

      setRules([...rules, newRule]);

      // Reset form
      setCustomRuleName('');
      setCustomRuleCode('');
      setCustomRulePriority(2);
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
            ? { ...rule, name: customRuleName, code: customRuleCode ?? '', priority: customRulePriority }
            : rule
        )
      );

      // Reset form and editing state
      setEditingRule(null);
      setCustomRuleName('');
      setCustomRuleCode(
        'function evaluate(schedule) {\n  const violations = [];\n  // Your custom rule logic here\n  // Example: Check if any team plays more than 3 games in a row on the same field\n  return violations;\n}'
      );
      setCustomRulePriority(2);
    } catch (err) {
      setError(`Error updating rule: ${(err as Error).message}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
    setCustomRuleName('');
    setCustomRuleCode(
      'function evaluate(schedule) {\n  const violations = [];\n  // Your custom rule logic here\n  // Example: Check if any team plays more than 3 games in a row on the same field\n  return violations;\n}'
    );
    setCustomRulePriority(2);
    setError(null);
  };

  const ruleExamples = [
    {
      name: 'Limit consecutive games on same field',
      code: `function evaluate(schedule) {
  const violations = [];
  const teamFieldHistory = {};
  
  // Group matches by team
  schedule.matches.forEach(match => {
    [match.team1.name, match.team2.name].forEach(teamName => {
      if (!teamFieldHistory[teamName]) {
        teamFieldHistory[teamName] = [];
      }
      teamFieldHistory[teamName].push({
        timeSlot: match.timeSlot,
        field: match.field
      });
    });
  });
  
  // Check for more than 2 consecutive games on same field
  Object.entries(teamFieldHistory).forEach(([teamName, games]) => {
    games.sort((a, b) => a.timeSlot - b.timeSlot);
    
    let consecutiveCount = 1;
    let currentField = games[0]?.field;
    
    for (let i = 1; i < games.length; i++) {
      if (games[i].field === currentField) {
        consecutiveCount++;
        if (consecutiveCount > 2) {
          violations.push({
            rule: "Limit consecutive games on same field",
            description: \`Team \${teamName} plays \${consecutiveCount} consecutive games on \${currentField}\`,
            matches: [games[i-1], games[i]]
          });
        }
      } else {
        consecutiveCount = 1;
        currentField = games[i].field;
      }
    }
  });
  
  return violations;
}`,
    },
    {
      name: 'Ensure minimum rest between games',
      code: `function evaluate(schedule) {
  const violations = [];
  const teamGames = {};
  
  // Group matches by team
  schedule.matches.forEach(match => {
    [match.team1.name, match.team2.name].forEach(teamName => {
      if (!teamGames[teamName]) {
        teamGames[teamName] = [];
      }
      teamGames[teamName].push(match);
    });
  });
  
  // Check for insufficient rest between games
  Object.entries(teamGames).forEach(([teamName, games]) => {
    games.sort((a, b) => a.timeSlot - b.timeSlot);
    
    for (let i = 0; i < games.length - 1; i++) {
      const timeDiff = games[i + 1].timeSlot - games[i].timeSlot;
      if (timeDiff < 2) { // Less than 2 time slots between games
        violations.push({
          rule: "Ensure minimum rest between games",
          description: \`Team \${teamName} has insufficient rest between games (only \${timeDiff} slots)\`,
          matches: [games[i], games[i + 1]]
        });
      }
    }
  });
  
  return violations;
}`,
    },
    {
      name: 'IntelliSense Demo - Type Definitions Showcase',
      code: `function evaluate(schedule) {
  const violations = [];
  
  // 🎯 INTELLISENSE DEMO - Try these features:
  // 1. Type "schedule." and press Ctrl+Space → see all properties
  // 2. Type "match." inside forEach → see team1, team2, timeSlot, field, etc.
  // 3. Type "ScheduleHelpers." → see helper functions
  // 4. Type "violationTemplate" and press Tab → get violation snippet
  // 5. Hover over any property → see JSDoc documentation
  
  // Example using enhanced type definitions with full autocomplete
  schedule.matches.forEach(match => {
    // ✨ Try typing "match." here - you'll see:
    // match.team1, match.team2, match.timeSlot, match.field, 
    // match.division, match.refereeTeam
    
    // Check if teams are playing too close together
    const teamNames = [match.team1.name, match.team2.name];
    
    teamNames.forEach(teamName => {
      // Find all other matches for this team
      const otherMatches = schedule.matches.filter(m =>
        (m.team1.name === teamName || m.team2.name === teamName) &&
        m.timeSlot !== match.timeSlot
      );
      
      // Check for matches too close in time
      otherMatches.forEach(otherMatch => {
        const timeDiff = Math.abs(match.timeSlot - otherMatch.timeSlot);
        
        if (timeDiff === 1) { // Consecutive time slots
          // ✨ Try typing "violationTemplate" here and press Tab!
          violations.push({
            rule: "Consecutive games detected",
            description: \`Team \${teamName} plays consecutive games at slots \${Math.min(match.timeSlot, otherMatch.timeSlot)} and \${Math.max(match.timeSlot, otherMatch.timeSlot)}\`,
            matches: [match, otherMatch],
            severity: "high"
          });
        }
      });
    });
    
    // Check referee assignment balance
    if (match.refereeTeam) {
      // ✨ Try typing "match.refereeTeam." → see name, division, players
      const refereeTeamMatches = schedule.matches.filter(m =>
        m.team1.name === match.refereeTeam.name || 
        m.team2.name === match.refereeTeam.name
      );
      
      // If referee team plays right after refereeing
      const conflictMatches = refereeTeamMatches.filter(m =>
        m.timeSlot === match.timeSlot + 1
      );
      
      if (conflictMatches.length > 0) {
        violations.push({
          rule: "Referee-Player conflict",
          description: \`Team \${match.refereeTeam.name} referees then immediately plays\`,
          matches: [match, ...conflictMatches],
          severity: "medium"
        });
      }
    }
  });
  
  // ✨ Try typing "ScheduleHelpers." to see helper functions:
  // groupMatchesByTeam, groupMatchesByField, getTeamMatches, 
  // areConsecutive, createViolation
  
  // Demonstrate field distribution analysis
  const fieldUsage = {};
  schedule.matches.forEach(match => {
    if (!fieldUsage[match.field]) {
      fieldUsage[match.field] = { count: 0, divisions: new Set() };
    }
    fieldUsage[match.field].count++;
    fieldUsage[match.field].divisions.add(match.division);
  });
  
  // Check for uneven field distribution
  const avgMatchesPerField = schedule.matches.length / Object.keys(fieldUsage).length;
  
  Object.entries(fieldUsage).forEach(([field, usage]) => {
    if (usage.count > avgMatchesPerField * 1.8) {
      violations.push({
        rule: "Field overuse",
        description: \`Field \${field} has \${usage.count} matches (avg: \${avgMatchesPerField.toFixed(1)})\`,
        matches: schedule.matches.filter(m => m.field === field),
        severity: "low"
      });
    }
  });
  
  return violations;
}`,
    },
  ];

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Scheduling Rules</h2>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">
              Configure rules and their priorities. Higher priority rules (1-10) will be satisfied first.
            </p>
            <p className="text-xs text-gray-500">
              Built-in rules are pre-tested common constraints. Custom rules allow advanced logic.
            </p>
          </div>
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
          >
            {showExamples ? 'Hide' : 'Show'} Examples
          </button>
        </div>

        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => handleToggleRule(rule.id)}
                  className="mr-3"
                />
                <div>
                  <span className={`font-medium ${!rule.enabled ? 'text-gray-400' : ''}`}>{rule.name}</span>
                  {rule.type === 'builtin' && (
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Built-in</span>
                  )}
                  {rule.type === 'custom' && (
                    <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">Custom</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
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
          ))}
        </div>
      </div>

      {showExamples && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-bold mb-3 text-blue-800">📚 Rule Examples & API Documentation</h3>

          <div className="mb-4 p-3 bg-white rounded border">
            <h4 className="font-semibold mb-2">📖 Rule Function API</h4>
            <div className="text-sm text-gray-700 space-y-2">
              <p>
                <strong>Input:</strong> <code className="bg-gray-100 px-1 rounded">schedule</code> object with:
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>
                  <code className="bg-gray-100 px-1 rounded">schedule.matches</code> - Array of match objects
                </li>
                <li>
                  <code className="bg-gray-100 px-1 rounded">match.timeSlot</code> - Numeric time slot
                </li>
                <li>
                  <code className="bg-gray-100 px-1 rounded">match.team1.name</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">match.team2.name</code> - Team names
                </li>
                <li>
                  <code className="bg-gray-100 px-1 rounded">match.field</code> - Field/court name
                </li>
                <li>
                  <code className="bg-gray-100 px-1 rounded">match.refereeTeam?.name</code> - Referee team (optional)
                </li>
              </ul>
              <p>
                <strong>Output:</strong> Array of violation objects with:
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>
                  <code className="bg-gray-100 px-1 rounded">rule</code> - Rule name
                </li>
                <li>
                  <code className="bg-gray-100 px-1 rounded">description</code> - Human-readable violation description
                </li>
                <li>
                  <code className="bg-gray-100 px-1 rounded">matches</code> - Array of affected matches (optional)
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            {ruleExamples.map((example, index) => (
              <div key={index} className="p-3 bg-white rounded border">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-purple-700">💡 {example.name}</h4>
                  <button
                    onClick={() => {
                      setCustomRuleName(example.name);
                      setCustomRuleCode(example.code);
                    }}
                    className="px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm"
                  >
                    Use Template
                  </button>
                </div>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-32">
                  <code>{example.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

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

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority (1-10)</label>
          <input
            type="number"
            value={customRulePriority}
            onChange={e => setCustomRulePriority(parseInt(e.target.value))}
            min="1"
            max="10"
            className="w-24 p-2 border rounded"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rule Logic (Typescript with IntelliSense)
          </label>
          <CodeEditor value={customRuleCode} onChange={setCustomRuleCode} height="400px" />
          <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
            <p className="font-medium mb-1">💡 Enhanced Features:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>
                <strong>Autocomplete:</strong> Press <kbd className="bg-white px-1 rounded border">Ctrl+Space</kbd> for
                suggestions
              </li>
              <li>
                <strong>Snippets:</strong> Type "violationTemplate", "forEachMatch", or "groupByTeam" for quick
                templates
              </li>
              <li>
                <strong>IntelliSense:</strong> Hover over properties for documentation
              </li>
              <li>
                <strong>Syntax Highlighting:</strong> Real-time JavaScript validation
              </li>
            </ul>
          </div>
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
