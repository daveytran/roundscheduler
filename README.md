# Round Scheduler

Round Scheduler is a NextJS application for tournament scheduling that allows tournament directors to optimize match schedules based on configurable rules.

## Features

- Import players and teams from CSV or by pasting from spreadsheets
- Import match schedules with team assignments
- Configure different scheduling formats (division blocks, etc.)
- Set up custom scheduling rules with priority levels
- Optimize schedules to minimize rule violations
- Visualize schedules by time or field
- Export optimized schedules as CSV

## Getting Started

### Prerequisites

- Node.js 14.x or later
- npm or yarn

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/roundscheduler.git
cd roundscheduler
```

2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Start the development server

```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage Guide

### 1. Import Players

Start by importing your players and their team assignments. The expected format is:

```
Player Name, Mixed Division Team, Gendered Team, Cloth Team
```

You can:

- Paste data directly from a spreadsheet
- Upload a CSV file

Each player can belong to one team per division.

### 2. Import Match Schedule

Next, import your initial match schedule. The expected format is:

```
Time Slot, Division, Field, Team 1, Team 2, Referee Team (optional)
```

### 3. Format Options

Choose how you want to format your schedule:

- As imported (sequential time slots)
- Division blocks (all matches for one division before moving to the next)

### 4. Configure Rules

Set up and prioritize scheduling rules:

- Avoid back-to-back games
- Avoid teams having first and last game
- Avoid teams reffing right before playing
- Create custom rules with JavaScript

### 5. Optimize Schedule

Run the optimizer to find a schedule that minimizes rule violations. The optimizer uses simulated annealing to:

- Randomize the schedule while respecting division blocks
- Evaluate rule violations
- Progressively improve the schedule
- Prioritize higher-priority rules

### 6. View and Export Results

View the optimized schedule by time slot or field, with rule violations highlighted. Export the final schedule as a CSV file.

## Custom Rules

You can create custom rules by writing JavaScript functions that evaluate a schedule and return an array of violations. Example:

```javascript
function evaluate(schedule) {
  const violations = [];
  // Check if any team plays more than 3 games in a row on the same field
  // Add violations to the array
  return violations;
}
```

## Development

- `models/` - Contains data structures for Players, Teams, Matches, and Scheduling
- `components/` - React components for different app features
- `lib/` - Utility functions for imports and schedule optimization
- `pages/` - NextJS pages and routing

## License

MIT
