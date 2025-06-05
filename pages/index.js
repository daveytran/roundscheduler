import { useState } from 'react';
import Head from 'next/head';
import ImportPlayers from '../components/ImportPlayers';
import ImportSchedule from '../components/ImportSchedule';
import ScheduleFormatOptions from '../components/ScheduleFormatOptions';
import RuleConfiguration from '../components/RuleConfiguration';
import ScheduleOptimizer from '../components/ScheduleOptimizer';
import ScheduleVisualization from '../components/ScheduleVisualization';
import { Schedule } from '../models/Schedule';

export default function Home() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState(null);
  const [matches, setMatches] = useState([]);
  const [formattedMatches, setFormattedMatches] = useState([]);
  const [schedulingRules, setSchedulingRules] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [activeTab, setActiveTab] = useState('import');
  
  const handlePlayersImport = (importedPlayers, importedTeams) => {
    setPlayers(importedPlayers);
    setTeams(importedTeams);
  };
  
  const handleScheduleImport = (importedMatches) => {
    setMatches(importedMatches);
    setFormattedMatches(importedMatches);
    
    // If this is the first data import, initialize teams
    if (!teams) {
      // Extract teams from matches
      const extractedTeams = {
        mixed: {},
        gendered: {},
        cloth: {}
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
    }
  };
  
  const handleFormatApplied = (newFormattedMatches) => {
    setFormattedMatches(newFormattedMatches);
  };
  
  const handleRulesChange = (rules) => {
    setSchedulingRules(rules);
  };
  
  const handleOptimizationComplete = (optimizedSchedule) => {
    setSchedule(optimizedSchedule);
    setActiveTab('results');
  };
  
  const tabs = [
    { id: 'import', label: 'Import Data' },
    { id: 'format', label: 'Format Options', disabled: !matches.length },
    { id: 'rules', label: 'Rules', disabled: !formattedMatches.length },
    { id: 'optimize', label: 'Optimize', disabled: !formattedMatches.length || !schedulingRules.length },
    { id: 'results', label: 'Results', disabled: !schedule }
  ];
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Round Scheduler - Tournament Scheduling Tool</title>
        <meta name="description" content="Tournament scheduling tool with rule-based optimization" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <header className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Round Scheduler</h1>
          <p className="text-blue-100">Tournament scheduling tool with rule-based optimization</p>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
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
                  You can either import players first and then a match schedule,
                  or import only a match schedule. The application will create teams
                  automatically from the schedule if needed.
                </p>
              </div>
              
              <ImportPlayers onImportComplete={handlePlayersImport} />
              <ImportSchedule 
                teams={teams} 
                onImportComplete={handleScheduleImport} 
              />
            </>
          )}
          
          {activeTab === 'format' && (
            <ScheduleFormatOptions 
              matches={matches} 
              onFormatApplied={handleFormatApplied} 
            />
          )}
          
          {activeTab === 'rules' && (
            <RuleConfiguration onRulesChange={handleRulesChange} />
          )}
          
          {activeTab === 'optimize' && (
            <ScheduleOptimizer 
              matches={formattedMatches} 
              rules={schedulingRules} 
              onOptimizationComplete={handleOptimizationComplete} 
            />
          )}
          
          {activeTab === 'results' && schedule && (
            <ScheduleVisualization schedule={schedule} />
          )}
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