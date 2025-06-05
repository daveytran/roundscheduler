import React, { useState, useEffect } from 'react';
import { 
  AvoidBackToBackGames, 
  AvoidFirstAndLastGame, 
  AvoidReffingBeforePlaying,
  CustomRule
} from '../models/ScheduleRule';

interface RuleConfigurationProps {
  onRulesChange?: (rules: any[]) => void;
}

export default function RuleConfiguration({ onRulesChange }: RuleConfigurationProps) {
  const [rules, setRules] = useState([
    {
      id: 'back_to_back',
      name: 'Avoid back-to-back games',
      enabled: true,
      priority: 5,
      type: 'builtin',
      class: AvoidBackToBackGames
    },
    {
      id: 'first_last',
      name: 'Avoid teams having first and last game',
      enabled: true,
      priority: 3,
      type: 'builtin',
      class: AvoidFirstAndLastGame
    },
    {
      id: 'reffing_before',
      name: 'Avoid teams reffing before playing',
      enabled: true,
      priority: 4,
      type: 'builtin',
      class: AvoidReffingBeforePlaying
    }
  ]);
  
  const [customRuleName, setCustomRuleName] = useState('');
  const [customRuleCode, setCustomRuleCode] = useState(
    'function evaluate(schedule) {\n  const violations = [];\n  // Your custom rule logic here\n  // Example: Check if any team plays more than 3 games in a row on the same field\n  return violations;\n}'
  );
  const [customRulePriority, setCustomRulePriority] = useState(2);
  const [error, setError] = useState(null);
  
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
              // Convert string function to actual function
              const evaluateFunc = new Function('schedule', rule.code);
              return new CustomRule(rule.name, evaluateFunc, rule.priority);
            } catch (err) {
              console.error(`Error creating custom rule: ${err.message}`);
              return null;
            }
          }
          return null;
        })
        .filter(rule => rule !== null);
      
      onRulesChange(enabledRules);
    }
  }, [rules, onRulesChange]);
  
  const handleToggleRule = (id) => {
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
    ));
  };
  
  const handlePriorityChange = (id, value) => {
    const priority = parseInt(value);
    if (isNaN(priority) || priority < 1 || priority > 10) return;
    
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, priority } : rule
    ));
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
        new Function('schedule', customRuleCode);
      } catch (err) {
        setError(`Invalid JavaScript: ${err.message}`);
        return;
      }
      
      // Create new rule
      const newRule = {
        id: `custom_${Date.now()}`,
        name: customRuleName,
        enabled: true,
        priority: customRulePriority,
        type: 'custom',
        code: customRuleCode
      };
      
      setRules([...rules, newRule]);
      
      // Reset form
      setCustomRuleName('');
      setCustomRuleCode(
        'function evaluate(schedule) {\n  const violations = [];\n  // Your custom rule logic here\n  // Example: Check if any team plays more than 3 games in a row on the same field\n  return violations;\n}'
      );
      setCustomRulePriority(2);
      
    } catch (err) {
      setError(`Error adding custom rule: ${err.message}`);
    }
  };
  
  const handleRemoveRule = (id) => {
    setRules(rules.filter(rule => rule.id !== id));
  };
  
  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Scheduling Rules</h2>
      
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-2">
          Configure rules and their priorities. Higher priority rules (1-10) will be satisfied first.
        </p>
        
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between p-2 border rounded">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => handleToggleRule(rule.id)}
                  className="mr-2"
                />
                <span className={!rule.enabled ? 'text-gray-400' : ''}>
                  {rule.name}
                </span>
              </div>
              
              <div className="flex items-center">
                <label className="mr-2 text-sm">
                  Priority:
                </label>
                <input
                  type="number"
                  value={rule.priority}
                  onChange={(e) => handlePriorityChange(rule.id, e.target.value)}
                  min="1"
                  max="10"
                  className="w-16 p-1 border rounded text-center"
                />
                
                {rule.type === 'custom' && (
                  <button
                    onClick={() => handleRemoveRule(rule.id)}
                    className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="border-t pt-4">
        <h3 className="font-bold mb-3">Add Custom Rule</h3>
        
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rule Name
          </label>
          <input
            type="text"
            value={customRuleName}
            onChange={(e) => setCustomRuleName(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="e.g., Avoid same team on same field twice"
          />
        </div>
        
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority (1-10)
          </label>
          <input
            type="number"
            value={customRulePriority}
            onChange={(e) => setCustomRulePriority(parseInt(e.target.value))}
            min="1"
            max="10"
            className="w-24 p-2 border rounded"
          />
        </div>
        
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rule Logic (JavaScript)
          </label>
          <textarea
            value={customRuleCode}
            onChange={(e) => setCustomRuleCode(e.target.value)}
            className="w-full h-48 p-2 border rounded font-mono text-sm"
          ></textarea>
          <p className="text-xs text-gray-500 mt-1">
            Write a function that takes a schedule object and returns an array of violations.
            Each violation should be an object with rule, description, and matches properties.
          </p>
        </div>
        
        <button
          onClick={handleAddCustomRule}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Add Custom Rule
        </button>
        
        {error && (
          <div className="p-2 mt-3 bg-red-100 border border-red-300 text-red-500 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}