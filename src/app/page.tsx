'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import ImportPlayers from '../components/ImportPlayers';
import ImportSchedule from '../components/ImportSchedule';
import ScheduleFormatOptions from '../components/ScheduleFormatOptions';
import RuleConfiguration from '../components/RuleConfiguration';
import ScheduleOptimizer from '../components/ScheduleOptimizer';
import ScheduleVisualization from '../components/ScheduleVisualization';
import { Player } from '../models/Player';
import { TeamsMap } from '../models/Team';
import { Match } from '../models/Match';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
  hasStoredData,
  getStorageSize,
} from '../lib/localStorage';
import { CustomRule } from '../models/ScheduleRule';

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<TeamsMap | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [formattedMatches, setFormattedMatches] = useState<Match[]>([]);
  const [schedulingRules, setSchedulingRules] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('import');
  const [dataLoadedFromStorage, setDataLoadedFromStorage] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Load data from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && hasStoredData()) {
      const savedData = loadFromLocalStorage();
      if (savedData.lastUpdated) {
        setPlayers(savedData.players || []);
        setTeams(savedData.teams || null);
        setMatches(savedData.matches || []);
        setFormattedMatches(savedData.formattedMatches || []);
        setSchedulingRules(savedData.schedulingRules || []);
        setSchedule(savedData.schedule || null);
        setLastUpdated(savedData.lastUpdated);
        setDataLoadedFromStorage(true);
      }
    }
  }, []);

  const handlePlayersImport = (importedPlayers: Player[], importedTeams: TeamsMap) => {
    setPlayers(importedPlayers);
    setTeams(importedTeams);
    saveToLocalStorage({ players: importedPlayers, teams: importedTeams });
  };

  const handleScheduleImport = (importedMatches: Match[]) => {
    setMatches(importedMatches);
    setFormattedMatches(importedMatches);

    let teamsToSave = teams;

    // If this is the first data import, initialize teams
    if (!teams) {
      // Extract teams from matches
      const extractedTeams: TeamsMap = {
        mixed: {},
        gendered: {},
        cloth: {},
      };

      importedMatches.forEach(match => {
        if (!extractedTeams[match.division]) {
          extractedTeams[match.division] = {};
        }

        extractedTeams[match.division][match.team1.name] = match.team1;
        extractedTeams[match.division][match.team2.name] = match.team2;

        if (match.refereeTeam) {
          extractedTeams[match.division][match.refereeTeam.name] = match.refereeTeam;
        }
      });

      setTeams(extractedTeams);
      teamsToSave = extractedTeams;
    }

    saveToLocalStorage({
      matches: importedMatches,
      formattedMatches: importedMatches,
      teams: teamsToSave,
    });
  };

  const handleFormatApplied = (newFormattedMatches: Match[]) => {
    setFormattedMatches(newFormattedMatches);
    saveToLocalStorage({ formattedMatches: newFormattedMatches });
  };

  const handleRulesChange = useCallback((rules: CustomRule[]) => {
    setSchedulingRules(rules);
    saveToLocalStorage({ schedulingRules: rules });
  }, []);

  const handleOptimizationComplete = (optimizedSchedule: any) => {
    setSchedule(optimizedSchedule);
    setActiveTab('results');
    saveToLocalStorage({ schedule: optimizedSchedule });
  };

  const handleClearStorage = () => {
    if (window.confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
      clearLocalStorage();
      setPlayers([]);
      setTeams(null);
      setMatches([]);
      setFormattedMatches([]);
      setSchedulingRules([]);
      setSchedule(null);
      setDataLoadedFromStorage(false);
      setLastUpdated('');
      setActiveTab('import');
    }
  };

  const tabs = [
    { id: 'import', label: 'Import Data' },
    { id: 'format', label: 'Format Options', disabled: !matches.length },
    { id: 'rules', label: 'Rules', disabled: !formattedMatches.length },
    { id: 'optimize', label: 'Optimize', disabled: !formattedMatches.length || !schedulingRules.length },
    { id: 'results', label: 'Results', disabled: !schedule },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Round Scheduler</h1>
              <p className="text-blue-100">Tournament scheduling tool with rule-based optimization</p>
            </div>

            {/* Storage Status & Controls */}
            <div className="text-right">
              {dataLoadedFromStorage && lastUpdated && (
                <div className="mb-2">
                  <div className="flex items-center justify-end gap-2 mb-1">
                    <span className="text-green-300 text-sm">💾 Data loaded from storage</span>
                  </div>
                  <div className="text-xs text-blue-200">
                    Last updated: {new Date(lastUpdated).toLocaleString()}
                    <br />
                    Size: {typeof window !== 'undefined' ? getStorageSize() : '0 KB'}
                  </div>
                </div>
              )}

              {(dataLoadedFromStorage || hasStoredData()) && (
                <button
                  onClick={handleClearStorage}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm transition-colors"
                  title="Clear all saved data"
                >
                  🗑️ Clear Storage
                </button>
              )}

              {!dataLoadedFromStorage && typeof window !== 'undefined' && hasStoredData() && (
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm transition-colors"
                  title="Reload to restore saved data"
                >
                  🔄 Reload Saved Data
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Auto-save notification with data summary */}
        {dataLoadedFromStorage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-600">✅</span>
                <div className="text-sm">
                  <strong className="text-green-800">Previous session restored!</strong>
                  <span className="text-green-700 ml-2">Your data is automatically saved as you work.</span>
                </div>
              </div>
              <div className="text-xs text-green-600">Last saved: {new Date(lastUpdated).toLocaleString()}</div>
            </div>

            {/* Data Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-green-200">
              <div className="text-center">
                <div className="text-lg font-bold text-green-700">{players.length}</div>
                <div className="text-xs text-green-600">Players</div>
              </div>

              <div className="text-center">
                <div className="text-lg font-bold text-green-700">
                  {teams
                    ? Object.keys(teams.mixed || {}).length +
                      Object.keys(teams.gendered || {}).length +
                      Object.keys(teams.cloth || {}).length
                    : 0}
                </div>
                <div className="text-xs text-green-600">Teams</div>
              </div>

              <div className="text-center">
                <div className="text-lg font-bold text-green-700">{matches.length}</div>
                <div className="text-xs text-green-600">Matches</div>
              </div>

              <div className="text-center">
                <div className="text-lg font-bold text-green-700">{schedulingRules.length}</div>
                <div className="text-xs text-green-600">Rules</div>
              </div>
            </div>

            {/* Detailed breakdown if there's data */}
            {(players.length > 0 || matches.length > 0 || (teams && Object.keys(teams).length > 0)) && (
              <details className="mt-3">
                <summary className="text-sm text-green-700 cursor-pointer hover:text-green-800">
                  📊 View detailed breakdown
                </summary>
                <div className="mt-3 p-3 bg-white rounded border text-sm">
                  {/* Teams breakdown */}
                  {teams && (
                    <div className="mb-3">
                      <h4 className="font-semibold text-gray-700 mb-2">Teams by Division:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {Object.entries(teams).map(([division, divisionTeams]) => (
                          <div key={division}>
                            <div className="font-medium text-gray-600 capitalize">{division} Division:</div>
                            <div className="text-gray-500 text-xs">
                              {Object.keys(divisionTeams || {}).length} teams
                              {Object.keys(divisionTeams || {}).length > 0 && (
                                <div className="ml-2 mt-1">
                                  {Object.keys(divisionTeams)
                                    .slice(0, 3)
                                    .map(teamName => (
                                      <div key={teamName} className="text-gray-400">
                                        • {teamName}
                                      </div>
                                    ))}
                                  {Object.keys(divisionTeams).length > 3 && (
                                    <div className="text-gray-400">
                                      ... and {Object.keys(divisionTeams).length - 3} more
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matches breakdown */}
                  {matches.length > 0 && (
                    <div className="mb-3">
                      <h4 className="font-semibold text-gray-700 mb-2">Matches:</h4>
                      <div className="text-gray-500 text-xs">
                        <div>• {matches.length} total matches imported</div>
                        <div>• {formattedMatches.length} formatted matches ready</div>
                        {schedule && <div>• Optimized schedule generated</div>}
                      </div>
                    </div>
                  )}

                  {/* Rules breakdown */}
                  {schedulingRules.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Active Rules:</h4>
                      <div className="text-gray-500 text-xs">
                        {schedulingRules.slice(0, 3).map((rule, index) => (
                          <div key={index}>• {rule.name || `Rule ${index + 1}`}</div>
                        ))}
                        {schedulingRules.length > 3 && <div>... and {schedulingRules.length - 3} more rules</div>}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        )}

        <div className="mb-6">
          <div className="flex border-b">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                className={`px-4 py-2 font-medium ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : tab.disabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-600 hover:text-blue-500'
                }`}
                disabled={tab.disabled}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {activeTab === 'import' && (
            <>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <h3 className="font-bold text-blue-800 mb-1">Import Options</h3>
                <p className="text-sm text-blue-700">
                  You can either import players first and then a match schedule, or import only a match schedule. The
                  application will create teams automatically from the schedule if needed.
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                  <span>💾</span>
                  <span>Data is automatically saved to your browser's local storage</span>
                </div>
              </div>

              <ImportPlayers onImportComplete={handlePlayersImport} />
              <ImportSchedule teams={teams} onImportComplete={handleScheduleImport} />
            </>
          )}

          {activeTab === 'format' && <ScheduleFormatOptions matches={matches} onFormatApplied={handleFormatApplied} />}

          {activeTab === 'rules' && <RuleConfiguration onRulesChange={handleRulesChange} />}

          {activeTab === 'optimize' && (
            <ScheduleOptimizer
              matches={formattedMatches}
              rules={schedulingRules}
              onOptimizationComplete={handleOptimizationComplete}
            />
          )}

          {activeTab === 'results' && schedule && <ScheduleVisualization schedule={schedule} />}
        </div>
      </main>

      <footer className="bg-gray-100 border-t mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
          <p>Round Scheduler - Tournament Scheduling Tool</p>
        </div>
      </footer>
    </div>
  );
}
