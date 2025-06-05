import React, { useState } from 'react';
import { createDivisionBlocks } from '../lib/scheduler';
import { Match } from '../models/Match';

interface ScheduleFormatOptionsProps {
  matches: Match[];
  onFormatApplied: (formattedMatches: Match[]) => void;
}

export default function ScheduleFormatOptions({ matches, onFormatApplied }: ScheduleFormatOptionsProps) {
  const [format, setFormat] = useState('as_is');
  const [divisionOrder, setDivisionOrder] = useState('mixed,gendered,cloth');
  const [error, setError] = useState<string | null>(null);

  // Get unique divisions from matches
  const getDivisions = (): string[] => {
    if (!matches || matches.length === 0) return [];
    const divSet = new Set<string>();
    matches.forEach((match: Match) => divSet.add(match.division));
    return Array.from(divSet);
  };

  const handleFormatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormat(e.target.value);
  };

  const handleDivisionOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDivisionOrder(e.target.value);
  };

  const handleApplyFormat = () => {
    try {
      setError(null);

      if (!matches || matches.length === 0) {
        setError('No matches available to format');
        return;
      }

      let formattedMatches = [...matches];

      // Apply selected format
      switch (format) {
        case 'division_blocks':
          // Validate division order
          const divisions = getDivisions();
          const orderedDivs = divisionOrder.split(',').map(d => d.trim());

          // Check that all divisions are accounted for
          const missingDivs = divisions.filter((d: string) => !orderedDivs.includes(d));
          if (missingDivs.length > 0) {
            setError(`Division order is missing: ${missingDivs.join(', ')}`);
            return;
          }

          formattedMatches = createDivisionBlocks([...matches], divisionOrder);
          break;

        case 'as_is':
        default:
          // No formatting needed, just ensure time slots are sequential
          formattedMatches.sort((a, b) => a.timeSlot - b.timeSlot);
          let timeSlot = 1;
          formattedMatches = formattedMatches.map(match => {
            const newMatch = new Match(
              match.team1,
              match.team2,
              timeSlot++,
              match.field,
              match.division,
              match.refereeTeam
            );
            return newMatch;
          });
          break;
      }

      // Notify parent component
      if (onFormatApplied) {
        onFormatApplied(formattedMatches);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Format error: ${errorMessage}`);
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Schedule Format Options</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Format</label>

        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="format"
              value="as_is"
              checked={format === 'as_is'}
              onChange={handleFormatChange}
              className="mr-2"
            />
            <span>As Imported (Sequential Time Slots)</span>
          </label>

          <label className="flex items-center">
            <input
              type="radio"
              name="format"
              value="division_blocks"
              checked={format === 'division_blocks'}
              onChange={handleFormatChange}
              className="mr-2"
            />
            <span>Division Blocks</span>
          </label>
        </div>
      </div>

      {format === 'division_blocks' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Division Order (comma-separated)</label>
          <input
            type="text"
            value={divisionOrder}
            onChange={handleDivisionOrderChange}
            className="w-full p-2 border border-gray-300 rounded"
            placeholder="e.g. mixed,gendered,cloth"
          />
          <p className="text-xs text-gray-500 mt-1">Available divisions: {getDivisions().join(', ')}</p>
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={handleApplyFormat}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
          disabled={!matches || matches.length === 0}
        >
          Apply Format
        </button>

        {!matches || matches.length === 0 ? (
          <span className="ml-2 text-amber-500 text-sm">Import matches first</span>
        ) : null}
      </div>

      {error && <div className="p-2 mb-4 bg-red-100 border border-red-300 text-red-500 rounded">{error}</div>}
    </div>
  );
}
