import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ScheduleVisualization, {
  DEFAULT_SCHEDULE_VISUALIZATION_SETTINGS,
  ScheduleVisualizationSettings,
} from '../../components/ScheduleVisualization';
import { Schedule } from '../../models/Schedule';
import { createMockMatch } from '../../lib/testUtils';

describe('ScheduleVisualization', () => {
  it('shows a violations-only view mode in the visualization', () => {
    const match = createMockMatch('Team A', 'Team B', 1, 'Field 1', 'mixed', 'Team C');
    const schedule = new Schedule([match]);
    schedule.score = 5;
    schedule.violations = [
      {
        rule: 'Consecutive Games Rule',
        description: 'Team A has back-to-back games',
        level: 'warning',
        matches: [match],
      },
    ];

    render(<ScheduleVisualization schedule={schedule} />);

    fireEvent.click(screen.getByRole('button', { name: 'Violations Only' }));

    expect(screen.getByText('Violation List (1)')).toBeTruthy();
    expect(screen.getByText('Affected Teams')).toBeTruthy();
    expect(screen.getByText(/Specific names are hidden\./)).toBeTruthy();
    expect(screen.queryByText('Team A has back-to-back games')).toBeNull();
    expect(screen.queryByText('Time Slot 1')).toBeNull();
  });

  it('respects Show Notes in violations-only mode', () => {
    const match = createMockMatch('Team D', 'Team E', 2, 'Field 2', 'mixed', 'Team F');
    const schedule = new Schedule([match]);
    schedule.score = 2;
    schedule.violations = [
      {
        rule: 'Warning Rule',
        description: 'Warning violation',
        level: 'warning',
        matches: [match],
      },
      {
        rule: 'Note Rule',
        description: 'Note violation',
        level: 'note',
        matches: [match],
      },
    ];

    render(<ScheduleVisualization schedule={schedule} />);

    fireEvent.click(screen.getByRole('button', { name: 'Violations Only' }));
    expect(screen.getByText('Violation List (1)')).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Notes' }));

    expect(screen.getByText('Violation List (2)')).toBeTruthy();
    expect(screen.queryAllByText('Note').length).toBeGreaterThan(0);
  });

  it('shows team/player split with chart and block-grid scale', () => {
    const match = createMockMatch('Team X', 'Team Y', 3, 'Field 3', 'mixed', 'Team Z');
    const schedule = new Schedule([match]);
    schedule.score = 7;
    const teamDescription = 'Team X has setup conflict';
    const playerDescription = 'Player Jane has insufficient rest';
    const otherDescription = 'Referee assignment imbalance in mixed division';
    schedule.violations = [
      {
        rule: 'Team Rule',
        description: teamDescription,
        level: 'warning',
        matches: [match],
      },
      {
        rule: 'Player Rule',
        description: playerDescription,
        level: 'alert',
        matches: [match],
      },
      {
        rule: 'Global Rule',
        description: otherDescription,
        level: 'warning',
        matches: [match],
      },
    ];

    render(<ScheduleVisualization schedule={schedule} />);

    fireEvent.click(screen.getByRole('button', { name: 'Violations Only' }));

    expect(screen.getByText('Severity Chart')).toBeTruthy();
    expect(screen.getByText('Team vs Player Scale')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Team/Player Split' }));
    expect(screen.queryByText(teamDescription)).toBeNull();
    expect(screen.queryByText(playerDescription)).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show specific teams/players' }));

    const teamSection = screen.getByRole('heading', { name: 'Team Violations' }).parentElement?.parentElement as HTMLElement;
    const playerSection = screen.getByRole('heading', { name: 'Player Violations' }).parentElement?.parentElement as HTMLElement;
    const otherSection = screen.getByRole('heading', { name: 'Other Violations' }).parentElement?.parentElement as HTMLElement;

    expect(within(teamSection).getByText('X')).toBeTruthy();
    expect(within(teamSection).queryByText('Jane')).toBeNull();
    expect(within(playerSection).getByText('Jane')).toBeTruthy();
    expect(within(otherSection).getByText(otherDescription)).toBeTruthy();
  });

  it('shows aggregate by-how-much summaries for quantitative limits', () => {
    const match = createMockMatch('Team Q', 'Team R', 4, 'Field 4', 'mixed', 'Team S');
    const schedule = new Schedule([match]);
    schedule.score = 9;
    schedule.violations = [
      {
        rule: 'Limit venue time',
        description: 'Team A needs to be at venue for 7.0 hours (max: 5h)',
        level: 'warning',
        matches: [match],
      },
      {
        rule: 'Limit venue time',
        description: 'Team B needs to be at venue for 6.0 hours (max: 5h)',
        level: 'warning',
        matches: [match],
      },
      {
        rule: 'Limit venue time',
        description: 'Team C needs to be at venue for 5.5 hours (max: 5h)',
        level: 'warning',
        matches: [match],
      },
    ];

    render(<ScheduleVisualization schedule={schedule} />);
    fireEvent.click(screen.getByRole('button', { name: 'Violations Only' }));

    expect(screen.getByText('By How Much')).toBeTruthy();
    expect(screen.getByText(/Limit venue time:/i)).toBeTruthy();
    expect(screen.getByText(/3 teams affected; venue time range 5.5-7 hrs \(up to 2 hrs over max\)/i)).toBeTruthy();
  });

  it('shows by-how-much details for specific teams and players when toggled on', () => {
    const match = createMockMatch('Team L', 'Team M', 5, 'Field 5', 'mixed', 'Team N');
    const schedule = new Schedule([match]);
    schedule.score = 8;
    schedule.violations = [
      {
        rule: 'Limit venue time',
        description: 'Team Alpha needs to be at venue for 7.0 hours (max: 5h)',
        level: 'warning',
        matches: [match],
      },
      {
        rule: 'Limit venue time',
        description: 'Player Jane needs to be at venue for 6.0 hours (max: 4h)',
        level: 'warning',
        matches: [match],
      },
    ];

    render(<ScheduleVisualization schedule={schedule} />);
    fireEvent.click(screen.getByRole('button', { name: 'Violations Only' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show specific teams/players' }));

    expect(screen.getByText(/7 hrs at venue \(2 hrs over max\)/i)).toBeTruthy();
    expect(screen.getByText(/6 hrs at venue \(2 hrs over max\)/i)).toBeTruthy();
  });

  it('shows pain spread metrics and distribution grids in violations-only mode', () => {
    const match = createMockMatch('Team Spread A', 'Team Spread B', 8, 'Field 8', 'mixed', 'Team Spread C');
    const schedule = new Schedule([match]);
    schedule.score = 12;
    schedule.violations = [
      {
        rule: 'Limit venue time',
        description: 'Team Alpha needs to be at venue for 7.0 hours (max: 5h)',
        level: 'warning',
        painPoints: 4,
        matches: [match],
      },
      {
        rule: 'Limit venue time',
        description: 'Team Beta needs to be at venue for 6.0 hours (max: 5h)',
        level: 'warning',
        painPoints: 4,
        matches: [match],
      },
      {
        rule: 'Manage rest time and gaps',
        description: 'Player Jamie has insufficient rest (1 slots) between games in slots 3 and 4',
        level: 'warning',
        painPoints: 4,
        matches: [match],
      },
    ];

    render(<ScheduleVisualization schedule={schedule} />);
    fireEvent.click(screen.getByRole('button', { name: 'Violations Only' }));

    expect(screen.getByText('Pain Spread')).toBeTruthy();
    expect(screen.getByText('League-wide spread')).toBeTruthy();
    expect(screen.getAllByText('Distribution Grid').length).toBeGreaterThan(0);
    expect(screen.getByText(/Objective:/i)).toBeTruthy();
  });

  it('shows gap size details for manage rest time and gaps in specific view', () => {
    const match = createMockMatch('Team Gap A', 'Team Gap B', 7, 'Field 7', 'mixed', 'Team Gap C');
    const schedule = new Schedule([match]);
    schedule.score = 4;
    schedule.violations = [
      {
        rule: 'Manage rest time and gaps',
        description: 'Player Taylor has insufficient rest (1 slots) between games in slots 2 and 3',
        level: 'warning',
        matches: [match],
      },
    ];

    render(<ScheduleVisualization schedule={schedule} />);
    fireEvent.click(screen.getByRole('button', { name: 'Violations Only' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show specific teams/players' }));

    expect(screen.getAllByText(/Manage rest time and gaps:/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/insufficient rest \(1 slots\)/i)).toBeTruthy();
  });

  it('keeps view mode and toggles in sync when settings are shared', () => {
    const match = createMockMatch('Team Sync A', 'Team Sync B', 6, 'Field 6', 'mixed', 'Team Sync C');
    const schedule = new Schedule([match]);
    schedule.score = 2;
    schedule.violations = [
      {
        rule: 'Sync Warning',
        description: 'Team Sync A has warning',
        level: 'warning',
        matches: [match],
      },
      {
        rule: 'Sync Note',
        description: 'Team Sync A has note',
        level: 'note',
        matches: [match],
      },
    ];

    function SyncHost() {
      const [sharedSettings, setSharedSettings] = React.useState<ScheduleVisualizationSettings>(
        DEFAULT_SCHEDULE_VISUALIZATION_SETTINGS
      );

      return (
        <div>
          <ScheduleVisualization
            schedule={schedule}
            visualizationSettings={sharedSettings}
            onVisualizationSettingsChange={settings => setSharedSettings(settings)}
          />
          <ScheduleVisualization
            schedule={schedule}
            visualizationSettings={sharedSettings}
            onVisualizationSettingsChange={settings => setSharedSettings(settings)}
          />
        </div>
      );
    }

    render(<SyncHost />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Violations Only' })[0]);
    expect(screen.getAllByText('Violation List (1)').length).toBe(2);

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Show Notes' })[0]);
    expect(screen.getAllByText('Violation List (2)').length).toBe(2);
  });
});
