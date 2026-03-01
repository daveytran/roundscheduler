import { Match } from '../models/Match';
import { RuleViolation } from '../models/RuleViolation';
import { Schedule } from '../models/Schedule';
import {
  CustomRuleDefinitionData,
  CustomRuleEngine,
  CustomRuleSourceType,
  RuleConfigurationData,
} from './localStorage';
import { ScheduleHelpers } from './schedule-helpers';

type CustomRuleEvaluator = (schedule: Schedule, scheduleHelpers: typeof ScheduleHelpers) => unknown;

const VALID_LEVELS: RuleViolation['level'][] = ['note', 'warning', 'alert', 'critical'];
const LEGACY_SEVERITY_TO_LEVEL: Record<string, RuleViolation['level']> = {
  low: 'note',
  medium: 'warning',
  high: 'alert',
};

export const DEFAULT_CUSTOM_RULE_TEMPLATE = `function evaluate(schedule) {
  const violations = [];
  // Your custom rule logic here
  return violations;
}`;

function isCustomRuleEngine(value: unknown): value is CustomRuleEngine {
  return value === 'javascript';
}

function isCustomRuleSourceType(value: unknown): value is CustomRuleSourceType {
  return value === 'evaluate-function' || value === 'body';
}

function hasEvaluateFunction(source: string): boolean {
  return /(^|\n)\s*(?:async\s+)?function\s+evaluate\s*\(/.test(source);
}

export function inferCustomRuleSourceType(source: string): CustomRuleSourceType {
  return hasEvaluateFunction(source) ? 'evaluate-function' : 'body';
}

export function createCustomRuleDefinition(
  source: string,
  definition?: Partial<CustomRuleDefinitionData>
): CustomRuleDefinitionData {
  const resolvedSource = typeof source === 'string' ? source : '';
  const inferredSourceType = inferCustomRuleSourceType(resolvedSource);
  const shouldReuseProvidedSourceType =
    isCustomRuleSourceType(definition?.sourceType) && definition?.source === resolvedSource;
  const sourceType: CustomRuleSourceType =
    shouldReuseProvidedSourceType && definition?.sourceType ? definition.sourceType : inferredSourceType;

  return {
    engine: isCustomRuleEngine(definition?.engine) ? definition.engine : 'javascript',
    version: 1,
    sourceType,
    source: resolvedSource,
  };
}

export function getCustomRuleDefinitionFromConfig(config: RuleConfigurationData): CustomRuleDefinitionData | null {
  if (config.type !== 'custom') {
    return null;
  }

  const source = config.customDefinition?.source ?? config.code;
  if (typeof source !== 'string' || source.trim().length === 0) {
    return null;
  }

  return createCustomRuleDefinition(source, config.customDefinition);
}

export interface CustomRuleValidationResult {
  valid: boolean;
  definition: CustomRuleDefinitionData;
  error?: string;
}

export function validateCustomRuleSource(
  source: string,
  definition?: Partial<CustomRuleDefinitionData>
): CustomRuleValidationResult {
  const normalizedDefinition = createCustomRuleDefinition(source, definition);

  try {
    compileEvaluator(normalizedDefinition);
    return { valid: true, definition: normalizedDefinition };
  } catch (error) {
    return {
      valid: false,
      definition: normalizedDefinition,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function compileCustomRuleDefinition(
  definition: CustomRuleDefinitionData,
  ruleName: string
): (schedule: Schedule) => RuleViolation[] {
  const evaluator = compileEvaluator(definition);

  return (schedule: Schedule): RuleViolation[] => {
    try {
      const rawResult = evaluator(schedule, ScheduleHelpers);
      return normalizeCustomRuleResult(rawResult, ruleName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return [
        {
          rule: ruleName,
          description: `Custom rule runtime error: ${message}`,
          level: 'critical',
        },
      ];
    }
  };
}

function compileEvaluator(definition: CustomRuleDefinitionData): CustomRuleEvaluator {
  if (definition.engine !== 'javascript') {
    throw new Error(`Unsupported custom rule engine: ${definition.engine}`);
  }

  if (definition.version !== 1) {
    throw new Error(`Unsupported custom rule version: ${definition.version}`);
  }

  if (definition.sourceType === 'evaluate-function') {
    return compileEvaluateFunctionSource(definition.source);
  }

  return compileBodySource(definition.source);
}

function compileEvaluateFunctionSource(source: string): CustomRuleEvaluator {
  const evaluateFactory = new Function(
    'ScheduleHelpers',
    `"use strict";
${source}
if (typeof evaluate !== "function") {
  throw new Error("Custom rule sourceType 'evaluate-function' must define function evaluate(schedule)");
}
return evaluate;`
  ) as (scheduleHelpers: typeof ScheduleHelpers) => (schedule: Schedule, scheduleHelpers?: typeof ScheduleHelpers) => unknown;

  const evaluateFunction = evaluateFactory(ScheduleHelpers);
  return (schedule: Schedule, scheduleHelpers: typeof ScheduleHelpers): unknown =>
    evaluateFunction(schedule, scheduleHelpers);
}

function compileBodySource(source: string): CustomRuleEvaluator {
  try {
    return new Function(
      'schedule',
      'ScheduleHelpers',
      `"use strict";
const violations = [];
${source}
return violations;`
    ) as CustomRuleEvaluator;
  } catch {
    // If users declare their own `violations` variable, fallback to direct execution.
    return new Function('schedule', 'ScheduleHelpers', `"use strict";
${source}`) as CustomRuleEvaluator;
  }
}

function normalizeCustomRuleResult(rawResult: unknown, fallbackRuleName: string): RuleViolation[] {
  if (rawResult == null) {
    return [];
  }

  const rawEntries = Array.isArray(rawResult) ? rawResult : [rawResult];
  const normalized: RuleViolation[] = [];

  rawEntries.forEach((entry, index) => {
    const normalizedEntry = normalizeViolationEntry(entry, fallbackRuleName, index);
    if (normalizedEntry) {
      normalized.push(normalizedEntry);
    }
  });

  return normalized;
}

function normalizeViolationEntry(entry: unknown, fallbackRuleName: string, index: number): RuleViolation | null {
  if (typeof entry === 'string') {
    return {
      rule: fallbackRuleName,
      description: entry,
      level: 'warning',
    };
  }

  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const value = entry as Record<string, unknown>;
  const rule = typeof value.rule === 'string' && value.rule.trim().length > 0 ? value.rule : fallbackRuleName;
  const description =
    typeof value.description === 'string' && value.description.trim().length > 0
      ? value.description
      : `Custom rule violation ${index + 1}`;

  const level = normalizeViolationLevel(value.level, value.severity);
  const matches = Array.isArray(value.matches) ? (value.matches as Match[]) : undefined;

  return {
    rule,
    description,
    level,
    matches,
  };
}

function normalizeViolationLevel(level: unknown, severity: unknown): RuleViolation['level'] {
  if (typeof level === 'string' && VALID_LEVELS.includes(level as RuleViolation['level'])) {
    return level as RuleViolation['level'];
  }

  if (typeof severity === 'string') {
    const mappedLevel = LEGACY_SEVERITY_TO_LEVEL[severity.toLowerCase()];
    if (mappedLevel) {
      return mappedLevel;
    }
  }

  return 'warning';
}
