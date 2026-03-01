import React, { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { DEFAULT_CUSTOM_RULE_TEMPLATE } from '../lib/custom-rule-templates';

interface CodeEditorProps {
  value: string | undefined;
  onChange: (value: string) => void;
  height?: string;
  language?: 'typescript' | 'javascript';
  placeholder?: string;
}

// Load type definitions from external file
// For now, we'll inline the content, but this could be loaded dynamically
const scheduleTypeDefinitions = `
/**
 * TypeScript declarations for the Monaco editor rule evaluation context
 * These types represent the objects available when writing schedule rules
 */

/**
 * Represents a team in the tournament
 */
declare interface Team {
  /** The team's name */
  name: string;
  /** Division the team plays in */
  division: 'mixed' | 'gendered' | 'cloth';
  /** Array of players on this team */
  players: Player[];
}

/**
 * Represents a player in the tournament
 */
declare interface Player {
  /** Player's full name */
  name: string;
  /** Team name for mixed division (optional) */
  mixedTeam?: string;
  /** Team name for gendered division (optional) */
  genderedTeam?: string;
  /** Team name for cloth division (optional) */
  clothTeam?: string;
}

/**
 * Represents a match between two teams
 */
declare interface Match {
  /** First team in the match */
  team1: Team;
  /** Second team in the match */
  team2: Team;
  /** Numeric time slot (lower numbers = earlier times) */
  timeSlot: number;
  /** Field/court identifier where match is played */
  field: string;
  /** Division this match belongs to */
  division: 'mixed' | 'gendered' | 'cloth';
  /** Team assigned to referee this match (null if no referee) */
  refereeTeam: Team | null;
}

/**
 * Represents a rule violation found in the schedule
 */
declare interface RuleViolation {
  /** Name of the rule that was violated */
  rule: string;
  /** Human-readable description of the violation */
  description: string;
  /** Array of matches involved in the violation (optional) */
  matches?: Match[];
  /** Severity level of the violation (optional, defaults to warning) */
  level?: 'note' | 'warning' | 'alert' | 'critical';
}

/**
 * Represents the complete tournament schedule
 */
declare interface Schedule {
  /** Array of all matches in the tournament */
  matches: Match[];
  /** Array of scheduling rules applied to this schedule */
  rules: any[];
  /** Array of rule violations found in this schedule */
  violations: RuleViolation[];
  /** Overall score (lower is better, 0 = no violations) */
  score: number;
  
  /**
   * Evaluate all rules and calculate the score
   * @returns The calculated score (lower is better)
   */
  evaluate(): number;
  
  /**
   * Create a randomized version of this schedule
   * @returns A new randomized schedule
   */
  randomize(): Schedule;
}

/**
 * Utility type for creating violations more easily
 */
declare interface ViolationBuilder {
  rule: string;
  description: string;
  matches?: Match[];
  level?: 'note' | 'warning' | 'alert' | 'critical';
}

/**
 * Helper functions available in the rule evaluation context
 */
declare namespace ScheduleHelpers {
  /**
   * Groups matches by team name
   * @param matches Array of matches to group
   * @returns Object with team names as keys and match arrays as values
   */
  function groupMatchesByTeam(matches: Match[]): Record<string, Match[]>;
  
  /**
   * Groups matches by field
   * @param matches Array of matches to group
   * @returns Object with field names as keys and match arrays as values
   */
  function groupMatchesByField(matches: Match[]): Record<string, Match[]>;

  /**
   * Groups matches by player name
   * @param matches Array of matches to group
   * @returns Object with player names as keys and match arrays as values
   */
  function groupMatchesByPlayer(matches: Match[]): Record<string, Match[]>;

  /**
   * Gets all players participating in a specific match
   * @param match The match to inspect
   * @returns Array of players from both teams
   */
  function getPlayersInMatch(match: Match): Player[];
  
  /**
   * Gets all matches for a specific team
   * @param schedule The schedule to search
   * @param teamName Name of the team
   * @returns Array of matches involving this team
   */
  function getTeamMatches(schedule: Schedule, teamName: string): Match[];

  /**
   * Gets all matches for a specific player
   * @param schedule The schedule to search
   * @param playerName Name of the player
   * @returns Array of matches involving this player
   */
  function getPlayerMatches(schedule: Schedule, playerName: string): Match[];
  
  /**
   * Checks if two matches are consecutive (timeSlot difference of 1)
   * @param match1 First match
   * @param match2 Second match
   * @returns True if matches are consecutive
   */
  function areConsecutive(match1: Match, match2: Match): boolean;
  
  /**
   * Creates a standardized violation object
   * @param rule Rule name
   * @param description Description of the violation
   * @param matches Matches involved (optional)
   * @param level Severity level (optional)
   * @returns Formatted violation object
   */
  function createViolation(
    rule: string, 
    description: string, 
    matches?: Match[], 
    level?: 'note' | 'warning' | 'alert' | 'critical'
  ): RuleViolation;
  
  /**
   * Groups matches by division
   * @param matches Array of matches to group
   * @returns Object with division names as keys and match arrays as values
   */
  function groupMatchesByDivision(matches: Match[]): Record<string, Match[]>;
  
  /**
   * Calculates basic statistics about the schedule
   * @param schedule The schedule to analyze
   * @returns Object with various schedule statistics
   */
  function getScheduleStats(schedule: Schedule): {
    totalMatches: number;
    totalPlayers: number;
    matchesPerTimeSlot: Record<number, number>;
    matchesPerField: Record<string, number>;
    matchesPerDivision: Record<string, number>;
    playersPerTeam: Record<string, number>;
  };
}

/**
 * Globals available in the custom rule execution context
 */
declare const schedule: Schedule;
declare const violations: RuleViolation[];

/**
 * Main function that evaluates a schedule for rule violations
 * @param schedule The schedule to evaluate
 * @returns Array of violations found
 */
declare function evaluate(schedule: Schedule): RuleViolation[];
`;

const defaultCode = DEFAULT_CUSTOM_RULE_TEMPLATE;

export default function CodeEditor({
  value,
  onChange,
  height = '400px',
  language = 'typescript',
  placeholder,
}: CodeEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoConfiguredRef = useRef(false);
  const monacoDisposablesRef = useRef<monaco.IDisposable[]>([]);

  useEffect(() => {
    return () => {
      monacoDisposablesRef.current.forEach(disposable => disposable.dispose());
      monacoDisposablesRef.current = [];
    };
  }, []);

  function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) {
    editorRef.current = editor;

    if (!monacoConfiguredRef.current) {
      const languageDefaults = [
        monaco.languages.typescript.typescriptDefaults,
        monaco.languages.typescript.javascriptDefaults,
      ];

      languageDefaults.forEach(defaults => {
        defaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ES2020,
          allowNonTsExtensions: true,
          moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          noEmit: true,
          allowJs: true,
          checkJs: true,
          strict: false,
          noImplicitAny: false,
          allowUmdGlobalAccess: true,
        });

        defaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
        });

        defaults.setEagerModelSync(true);
      });

      monacoDisposablesRef.current.push(
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          scheduleTypeDefinitions,
          'file:///types/schedule-types.ts'
        ),
        monaco.languages.typescript.javascriptDefaults.addExtraLib(
          scheduleTypeDefinitions,
          'file:///types/schedule-types.js'
        )
      );

      // Add custom autocomplete snippets for both TS and JS editor modes.
      const completionProvider = {
        triggerCharacters: ['.'],
        provideCompletionItems: (model: monaco.editor.ITextModel, position: monaco.Position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions = [
          // Schedule properties
          {
            label: 'schedule.matches',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'schedule.matches',
            documentation: 'Array of all matches in the tournament',
            range: range,
          },
          {
            label: 'schedule.violations',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'schedule.violations',
            documentation: 'Array of rule violations found in this schedule',
            range: range,
          },
          {
            label: 'schedule.score',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'schedule.score',
            documentation: 'Overall score (lower is better, 0 = no violations)',
            range: range,
          },
          {
            label: 'schedule.evaluate',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'schedule.evaluate()',
            documentation: 'Evaluate all rules and calculate the score',
            range: range,
          },

          // Match properties
          {
            label: 'match.team1',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'match.team1',
            documentation: 'First team in the match',
            range: range,
          },
          {
            label: 'match.team2',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'match.team2',
            documentation: 'Second team in the match',
            range: range,
          },
          {
            label: 'match.timeSlot',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'match.timeSlot',
            documentation: 'Numeric time slot (lower numbers = earlier times)',
            range: range,
          },
          {
            label: 'match.field',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'match.field',
            documentation: 'Field/court identifier where match is played',
            range: range,
          },
          {
            label: 'match.division',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'match.division',
            documentation: 'Division this match belongs to (mixed, gendered, cloth)',
            range: range,
          },
          {
            label: 'match.refereeTeam',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'match.refereeTeam',
            documentation: 'Team assigned to referee this match (null if no referee)',
            range: range,
          },

          // Team properties
          {
            label: 'team.name',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'team.name',
            documentation: "The team's name",
            range: range,
          },
          {
            label: 'team.division',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'team.division',
            documentation: 'Division the team plays in',
            range: range,
          },
          {
            label: 'team.players',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'team.players',
            documentation: 'Array of players on this team',
            range: range,
          },

          // Helper functions
          {
            label: 'ScheduleHelpers.groupMatchesByTeam',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'ScheduleHelpers.groupMatchesByTeam(${1:matches})',
            documentation: 'Groups matches by team name - returns object with team names as keys',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'ScheduleHelpers.groupMatchesByField',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'ScheduleHelpers.groupMatchesByField(${1:matches})',
            documentation: 'Groups matches by field - returns object with field names as keys',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'ScheduleHelpers.groupMatchesByPlayer',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'ScheduleHelpers.groupMatchesByPlayer(${1:matches})',
            documentation: 'Groups matches by player name - returns object with player names as keys',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'ScheduleHelpers.getPlayersInMatch',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'ScheduleHelpers.getPlayersInMatch(${1:match})',
            documentation: 'Gets all players participating in a match',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'ScheduleHelpers.getTeamMatches',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'ScheduleHelpers.getTeamMatches(${1:schedule}, "${2:teamName}")',
            documentation: 'Gets all matches for a specific team',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'ScheduleHelpers.getPlayerMatches',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'ScheduleHelpers.getPlayerMatches(${1:schedule}, "${2:playerName}")',
            documentation: 'Gets all matches for a specific player',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'ScheduleHelpers.areConsecutive',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'ScheduleHelpers.areConsecutive(${1:match1}, ${2:match2})',
            documentation: 'Checks if two matches are consecutive (timeSlot difference of 1)',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'ScheduleHelpers.createViolation',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'ScheduleHelpers.createViolation("${1:rule}", "${2:description}", ${3:matches})',
            documentation: 'Creates a standardized violation object',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'ScheduleHelpers.groupMatchesByDivision',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'ScheduleHelpers.groupMatchesByDivision(${1:matches})',
            documentation: 'Groups matches by division - returns object with division names as keys',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'ScheduleHelpers.getScheduleStats',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'ScheduleHelpers.getScheduleStats(${1:schedule})',
            documentation: 'Calculates basic statistics about the schedule',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },

          // Code snippets
          {
            label: 'violationTemplate',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'violations.push({',
              '  rule: "${1:Rule Name}",',
              '  description: `${2:Description of violation}`,',
              '  matches: [${3:affectedMatches}],',
              '  level: "${4|note,warning,alert,critical|}"',
              '});',
            ].join('\n'),
            documentation: 'Template for creating a rule violation with all properties',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'forEachMatch',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'schedule.matches.forEach(match => {',
              '  ${1:// Process each match - access match.team1, match.team2, match.timeSlot, etc.}',
              '});',
            ].join('\n'),
            documentation: 'Loop through all matches in the schedule',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'groupByTeam',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'const teamMatches = {};',
              'schedule.matches.forEach(match => {',
              '  [match.team1.name, match.team2.name].forEach(teamName => {',
              '    if (!teamMatches[teamName]) {',
              '      teamMatches[teamName] = [];',
              '    }',
              '    teamMatches[teamName].push(match);',
              '  });',
              '});',
              '',
              '// Now teamMatches[teamName] contains all matches for each team',
            ].join('\n'),
            documentation: 'Group all matches by team name for easier analysis',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'groupByField',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'const fieldMatches = {};',
              'schedule.matches.forEach(match => {',
              '  if (!fieldMatches[match.field]) {',
              '    fieldMatches[match.field] = [];',
              '  }',
              '  fieldMatches[match.field].push(match);',
              '});',
              '',
              '// Now fieldMatches[fieldName] contains all matches for each field',
            ].join('\n'),
            documentation: 'Group all matches by field for analysis',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'consecutiveGamesCheck',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'const teamMatches = {};',
              'schedule.matches.forEach(match => {',
              '  [match.team1.name, match.team2.name].forEach(teamName => {',
              '    if (!teamMatches[teamName]) teamMatches[teamName] = [];',
              '    teamMatches[teamName].push(match);',
              '  });',
              '});',
              '',
              'Object.entries(teamMatches).forEach(([teamName, matches]) => {',
              '  matches.sort((a, b) => a.timeSlot - b.timeSlot);',
              '  ',
              '  for (let i = 0; i < matches.length - 1; i++) {',
              '    if (matches[i + 1].timeSlot - matches[i].timeSlot === 1) {',
              '      violations.push({',
              '        rule: "${1:Consecutive games rule}",',
              '        description: `Team ${teamName} has consecutive games`,',
              '        matches: [matches[i], matches[i + 1]]',
              '      });',
              '    }',
              '  }',
              '});',
            ].join('\n'),
            documentation: 'Complete template for checking consecutive games violations',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
          {
            label: 'consecutiveGamesHelper',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              '// Use helper functions to find consecutive matches',
              'const teamMatches = ScheduleHelpers.groupMatchesByTeam(schedule.matches);',
              '',
              'Object.entries(teamMatches).forEach(([teamName, matches]) => {',
              '  const sorted = [...matches].sort((a, b) => a.timeSlot - b.timeSlot);',
              '  for (let i = 0; i < sorted.length - 1; i++) {',
              '    if (ScheduleHelpers.areConsecutive(sorted[i], sorted[i + 1])) {',
              '      violations.push({',
              '        rule: "${1:Consecutive games rule}",',
              '        description: `Team ${teamName} has consecutive games at slots ${sorted[i].timeSlot} and ${sorted[i + 1].timeSlot}`,',
              '        matches: [sorted[i], sorted[i + 1]],',
              '        level: "${2|note,warning,alert,critical|}"',
              '      });',
              '    }',
              '  }',
              '});',
            ].join('\n'),
            documentation: 'Use ScheduleHelpers.groupMatchesByTeam + areConsecutive for back-to-back checks',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          },
        ];

          return { suggestions };
        },
      };

      monacoDisposablesRef.current.push(
        monaco.languages.registerCompletionItemProvider('typescript', completionProvider),
        monaco.languages.registerCompletionItemProvider('javascript', completionProvider)
      );

      monacoConfiguredRef.current = true;
    }

    editor.focus();
  }

  function handleEditorChange(value: string | undefined) {
    if (onChange && value !== undefined) {
      onChange(value);
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-3 py-2 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">📝 Rule Body Editor</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
              schedule available • TypeScript + IntelliSense
            </span>
          </div>
          <div className="text-xs text-gray-500">Ctrl+Space for autocomplete • Ctrl+/ for comments</div>
        </div>
      </div>

      <Editor
        height={height}
        language={language}
        value={value || defaultCode}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="vs"
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          lineNumbers: 'on',
          glyphMargin: true,
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          renderLineHighlight: 'gutter',
          selectOnLineNumbers: true,
          automaticLayout: true,
          wordWrap: 'on',
          wrappingIndent: 'indent',
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          tabCompletion: 'on',
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false,
          },
          parameterHints: {
            enabled: true,
          },
          autoIndent: 'advanced',
          formatOnPaste: true,
          formatOnType: true,
        }}
      />
    </div>
  );
}
