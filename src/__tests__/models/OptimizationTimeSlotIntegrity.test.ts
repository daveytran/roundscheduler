import { Schedule } from '../../models/Schedule'
import { Match } from '../../models/Match'
import { Team } from '../../models/Team'
import { Player } from '../../models/Player'
import { SIMULATED_ANNEALING_OPTIMIZE, OPTIMIZATION_STRATEGIES } from '../../models/OptimizationStrategy'
import { AvoidBackToBackGames, AvoidReffingBeforePlaying, LimitVenueTime, EnsureFairFieldDistribution, ScheduleRule, AvoidFirstAndLastGame } from '../../models/ScheduleRule'
import { RuleViolation } from '../../models/RuleViolation'
import { importSchedule, parsePastedScheduleData, ImportedScheduleRow } from '../../lib/importUtils'
import { TeamsMap } from '../../models/Team'
const REAL_PLAYER_DATA = `
Mixed Team	Gendered Foam	Open Cloth	Player
North Star Storm	North Star Storm	North Star Storm	Adrian Bird
	Sun Valley Storm	Hoxton Park Hedgehogs	Ahmed Chatila
	Kingsford Mavericks		Ainsley Nair
	Ashbury Firehawks		Alan Han
	Manly Magicians	North Star Storm	Alex Jones
Fairfield Falcons	Diehard Darknights	Sun Valley Storm 	Alexander Baeza
	Oakhurst Orcas	Cooneys Creek Cheetahs	Alfred Bi
Double Bay Dragonites			Alice Choy
Oakhurst Orcas	Oakhurst Orcas		Alicia Giang
Darkwood Immortals	Kingsford Mavericks		Allan Xie
Marsfield Meteors	Canterbury Nines	Cunningar Cheetahs	Alvin Lam
Pan Ban Pandas	Liverpool Lightning		Alvis Leung
Como Chaos	Arkstone Akuma		Amanda Pritchard
Maison Dieu Mazoku		Duckenfield Dreamers	Amanda Trinh
Ultimo Falcons	Kirribilli Kangaroos	Hoxton Park Hedgehogs	Ameya Shinde
Double Bay Dragonites	Valla Valkyries		Amy Cchour
Ashbury Inferno	Firefly Sirens		Amy Li
Sun Valley Storm	Magenta Storm		Amy Moore
Oakville Orcas	Oakhurst Orcas		Andrew Bosnjak
Villawood Hydra	Ashbury Firehawks		Andrew Le Huynh
Chatswood Chibis			Andrew Nguyen
	Diehard Darknights		Andrew Robertson
Fairfield Falcons	Five Dock Falcons		Andy Ban
	Liverpool Lightning	Canterbury Nines	Angelo Dela Cruz
Maison Dieu Mazoku	Kingsford Mavericks		Anh Nguyen
Iluka Immortals	Sapphire Sirens		Anita Trieu
Iluka Immortals	Darkwood Deathdealers	Hoxton Park Hedgehogs	Anita-Joy Morgan
Villawood Hydra			Annette Mai
Pan Ban Pandas	Liverpool Lightning		Anthony He
North Star Storm	North Star Storm	Sun Valley Storm 	Anthony Richards
Como Chaos	Auburn Ultras	Deepwater Storm	Arthur Hu
Villawood Hydra	Kirribilli Kangaroos		Arthur Leung
	UTS Lizards Teal		Asher Kim
UTS Lizards	UTS Lizards White		Au Yong Jun Sheng 
	Sefton Stunners	Hoxton Park Hedgehogs	Augusto Simoes
	Limpinwood Lions		Baldeep Uppal
Ultimo Falcons	Valla Valkyries		Bavishiya Jeyakumar
Darkwood Immortals	Sapphire Sirens		Belinda Luo
Oakville Orcas			Benjamin Yeong
Sun Valley Storm	Magenta Storm		Bianca Hungerford
Sun Valley Storm	Sun Valley Storm	Sun Valley Storm 	Blake Hungerford
	Razorback Raptors	Hoxton Park Hedgehogs	Boby Thammavongsa
	Manly Magicians		Brandon Daniel Chasles
Como Chaos	Auburn Ultras		Brendon On
Marsfield Meteors	Firefly Sirens		Canny Wang
Fairfield Falcons	Valla Valkyries	Deepwater Storm	Cara Nguyen
Darkwood Immortals	Sapphire Sirens	Duckmaloi Dreamers	Carolyn Lee
Elderslie Empyreans	Lilyfield Labubus	Cunningar Cheetahs	Celina Huynh
Como Chaos	Darkwood Deathdealers		Charlotte Chen
Oakville Orcas	Oakhurst Orcas		Charlotte Tam
Pan Ban Pandas	Liverpool Lightning		Chris Nguyen
	Sefton Stunners		Christian Medina
Oakville Orcas			Christopher Leung-Chee-Hang
Double Bay Dragonites	Kirribilli Kangaroos	Cooneys Creek Cheetahs	Christopher Tint
Oakville Orcas	Oakhurst Orcas		Chun Kei Ma
North Star Storm	Magenta Storm	North Star Storm	Ciarin Christie
Fairfield Falcons			Cindy Tran
Liverpool Lightning	Sapphire Sirens	Liverpool Lightning	Cloris Wong
Darkwood Immortals	Kingswood Mavericks	Liverpool Lightning	Conor Keith
Lilli Pilli Lions	Limpinwood Lions	Cooneys Creek Cheetahs	Corey Tran
Fairlight Ascendants	Warburn Wraiths		Daniel Cai
Chatswood Chibis	Auburn Ultras		Daniel Hua
Ashbury Inferno	Kingsford Mavericks		Daniel Luc
UTS Lizards	UTS Lizards Teal	Duckenfield Dreamers	Daniel Mawston
Oakville Orcas	Oakhurst Orcas		Daniel Southworth
	Razorback Raptors		Daniel Vu
Oakhurst Orcas	Oakhurst Orcas	Cunningar Cheetahs	Danny Tran
Pan Ban Pandas	Liverpool Lightning		Darren Fung
Canterbury Nines	Canterbury Nines	Canterbury Nines	Davey Tran
	Five Dock Falcons		David Ho
	Sun Valley Storm		David Tabley
Fairfield Falcons			Dee Nguyen
	Razorback Raptors		Derek Le
Darkwood Immortals	Kingswood Mavericks		Derik Phan Truong
Liverpool Lightning	North Star Storm	North Star Storm	Don Brown
		Hoxton Park Hedgehogs	Doon Wongla
	Lilyfield Labubus		Dorothy Ngo
Fairfield Falcons	Sefton Stunners		Eddy Tran
Ultimo Falcons	Ashbury Firehawks		Edwin Phuong
Villawood Hydra	Valla Valkyries		Eleonora Chelli
Sun Valley Storm	Magenta Storm		Eliza Hungerford
Sun Valley Storm	Magenta Storm		Emily Davies
Ultimo Falcons	Valla Valkyries		Emily Saunders
Oakhurst Orcas	Arkstone Akuma		Emily Strong
North Star Storm	Magenta Storm	North Star Storm	Emma Griffiths
Fairlight Ascendants	Warburn Wraiths		Eric Luu
Como Chaos	Auburn Ultras		Ernest Chau
Banda Banda Pandas			Evelyn Tran
Fairlight Ascendants	Ashbury Firehawks		Fadily Farid
Pan Ban Pandas			Gabriella Gerich
Lilli Pilli Lions	Lilyfield Labubus	Cooneys Creek Cheetahs	Gabrielle Po-Myat
	Sefton Stunners		Gavin Pang
Villawood Hydra	Auburn Ultras		George Lo
Oakville Orcas	Oakhurst Orcas		Hannah Yee
Canterbury Nines			Harriet Tan
	Deepwater Storm		Hector Wang
	Deepwater Storm	Deepwater Storm	Henry George 
	Diehard Darknights		Hung Ma
UTS Lizards	Chatswood Chibis		Huong Dinh
Lilli Pilli Lions	Lilyfield Labubus		Ifra Zubairi
Maison Dieu Mazoku	Sapphire Sirens	Canterbury Nines	Isabelle Dalangin
Double Bay Dragonites	Canterbury Nines	Duckmaloi Dreamers	Jack Lao
Oakhurst Orcas	Warburn Wraiths		Jacob Diffen
Oakhurst Orcas	Oakhurst Orcas	Liverpool Lightning	Jacob Smith
		Deepwater Storm	Jaimi Bubb
	Sun Valley Storm		Jaimi Bubb
Iluka Immortals	Warburn Wraiths		James Fu
	Deepwater Storm		Jamie Ambrose
Fairfield Falcons	Valla Valkyries		Jamie De Vega
Ultimo Falcons	Razorback Raptors		Jamie Tran
Oakhurst Orcas	Oakhurst Orcas		Janet Lim
Canterbury Nines	Oakhurst Orcas		Jasmine Hout
		Duckmaloi Dreamers	Jason Harvey
	Deepwater Storm		Jayden Carter
	UTS Lizards Teal		Jayden Faint
Liverpool Lightning	Liverpool Lightning		Jeffrey Kwan
Maison Dieu Mazoku	Canterbury Nines	Canterbury Nines	Jeffrey Lualhati
Double Bay Dragonites	Chatswood Chibis		Jennifer Tran
Iluka Immortals	Sapphire Sirens		Jenny Ear
Villawood Hydra	Arkstone Akuma		Jenny Le-Huynh
Pan Ban Pandas		Liverpool Lightning	Jenny Nguyen
Elderslie Empyreans	Lilyfield Labubus		Jeremae Quezada
	Limpinwood Lions		Jeremy U
Lilli Pilli Lions			Jessica Choong Lim Goh
Oakville Orcas	Oakhurst Orcas		Joe Vu
Villawood Hydra	Ashbury Firehawks		John Stratigos
	Limpinwood Lions		Johnny Do
		Hoxton Park Hedgehogs	Jonathan Pascua
Ashbury Inferno	Kingsford Mavericks		Jonathan Sun
Liverpool Lightning	Liverpool Lightning	Liverpool Lightning	Joshua Barnier
	Diehard Darknights	Hoxton Park Hedgehogs	Joshua Garcia
	North Star Storm	Sun Valley Storm 	Joshua Melrose
Villawood Hydra		Duckmaloi Dreamers	Judy Ung
	Limpinwood Lions		Kalvin Vuong
Ashbury Inferno	Firefly Sirens		Karen Jian
Oakville Orcas	Oakhurst Orcas		Katie Yates
Elderslie Empyreans	Kingswood Mavericks	Cunningar Cheetahs	Keiron Marc Lee
Oakhurst Orcas	Oakhurst Orcas		Kelly Koay
Lilli Pilli Lions	Kirribilli Kangaroos	Cooneys Creek Cheetahs	Kelvin Chan
	UTS Lizards White		Kennan Tran
Maison Dieu Mazoku	Canterbury Nines	Duckenfield Dreamers	Kent Tran
Banda Banda Pandas	Diehard Darknights	Sun Valley Storm 	Kevin Lennie
Iluka Immortals	Kingswood Mavericks		Kevin Tao
Chatswood Chibis	Kingswood Mavericks	Duckenfield Dreamers	Kevin Vo
Double Bay Dragonites	Kirribilli Kangaroos		Khang Hoang
		Canterbury Nines	Kim Hua
Double Bay Dragonites	Chatswood Chibis		Kim Tran
Liverpool Lightning	Darkwood Deathdealers		Kimberly De Leon
Pan Ban Pandas	Darkwood Deathdealers		Lauren Keith
Banda Banda Pandas	Valla Valkyries	Sun Valley Storm 	Lillikan Forrs
Darkwood Immortals	Darkwood Deathdealers	Liverpool Lightning	Lily Nguyen
Oakville Orcas	Oakhurst Orcas		Linda Tran
Canterbury Nines		Canterbury Nines	Linh Hoang
Fairlight Ascendants	Sapphire Sirens		Lisa Cai
Sun Valley Storm	Sun Valley Storm		Lucas Portelli
	Sun Valley Storm	Deepwater Storm	Luke Logan-Jones
Chatswood Chibis	Arkstone Akuma		Ly Nguyen
Maison Dieu Mazoku	Firefly Sirens		Mai Nguyen
Oakville Orcas	Oakhurst Orcas		Mandy Van
Iluka Immortals			Maria Buenaventura
Marsfield Meteors	Arkstone Akuma		Maricon Sarinas
Oakhurst Orcas	Kingswood Mavericks		Martin Li
	Sun Valley Storm		Mason Van Tilborg
	Razorback Raptors		Matthew Barnier
North Star Storm	North Star Storm	Sun Valley Storm 	Matthew Jackson
	Warburn Wraiths		Matthew Thapa
Banda Banda Pandas			Matthew Yuan
Marsfield Meteors	Warburn Wraiths		Melvin Buenaventura
Ultimo Falcons			Michael Lau
	Razorback Raptors		Michael Lintag
North Star Storm	North Star Storm	North Star Storm	Michael Townsend
Iluka Immortals	Kingsford Mavericks		Michael Tran
	Limpinwood Lions	Cooneys Creek Cheetahs	Michael Vo
Fairlight Ascendants	Warburn Wraiths	Duckenfield Dreamers	Michael Wai
Como Chaos	Darkwood Deathdealers		Michel Li
Fairlight Ascendants	Darkwood Deathdealers		Michelle Huynh
	Sefton Stunners		Minh Le
Fairfield Falcons	Five Dock Falcons		Minh Thanh Le
	Razorback Raptors		Mitch Sun
Fairlight Ascendants	Firefly Sirens		Monique Yap
	Five Dock Falcons		Nathan Huynh
	UTS Lizards White		Ng Hew Wee
Chatswood Chibis	Arkstone Akuma	Duckenfield Dreamers	Nhan Dinh-Vu
	Sun Valley Storm	Deepwater Storm	Nic Price
Como Chaos	Auburn Ultras		Nicholas Lau
Oakhurst Orcas	Oakhurst Orcas		Nicholas Young
Sun Valley Storm	Deepwater Storm		Nick Portelli
Oakhurst Orcas	Oakhurst Orcas		Nicky Nguyen
	Five Dock Falcons		Nikhil Kumar
Chatswood Chibis	Chatswood Chibis	Duckmaloi Dreamers	Nikita Zhang
Pan Ban Pandas			Nita Tran
Sun Valley Storm	North Star Storm		Noah Costello
	Kirribilli Kangaroos		Pak Hin Ho
UTS Lizards	Chatswood Chibis		Paris Wei
Villawood Hydra	Auburn Ultras		Paul Phan
Ashbury Inferno	Ashbury Firehawks		Paul Tran
Canterbury Nines	Ashbury Firehawks	Duckenfield Dreamers	Peter Ngo
	Manly Magicians		Peter Phan
Canterbury Nines	Canterbury Nines	Canterbury Nines	Phillip Nong
	Oakhurst Orcas		Prisca Hadikusumo
Marsfield Meteors			Profita Keo
	Oakhurst Orcas		Rachel Yeung
Liverpool Lightning	Darkwood Deathdealers	Liverpool Lightning	Rachelle Ting
Elderslie Empyreans	Kingsford Mavericks	Cunningar Cheetahs	Rahul Subramanya
Ultimo Falcons	Kirribilli Kangaroos		Raymond Skelton
Sun Valley Storm	North Star Storm	North Star Storm	Reece Strong
Fairfield Falcons			Reynard Girado
Elderslie Empyreans	Kingsford Mavericks		Ricky Mai
Liverpool Lightning	Liverpool Lightning	Liverpool Lightning	Robert Worth
	Deepwater Storm		Rohan Jayasimha
	Five Dock Falcons	Duckmaloi Dreamers	Ryan Carrington
Lilli Pilli Lions	Limpinwood Lions	Cunningar Cheetahs	Ryan Tchan
	Canterbury Nines	Duckmaloi Dreamers	Sahil Kapoor
Fairfield Falcons	Five Dock Falcons		Saintly Luanglath
Marsfield Meteors	Arkstone Akuma	Duckenfield Dreamers	Sakura Kagaya
Elderslie Empyreans	Warburn Wraiths		Sam Lama
	UTS Lizards Teal		Samir Zala
North Star Storm	Magenta Storm	Sun Valley Storm 	Sarah Mitchell
Como Chaos			Sarah On
Elderslie Empyreans	Lilyfield Labubus		Sarah Zeng
Liverpool Lightning	Valla Valkyries	Deepwater Storm	Shelley Tu
Ultimo Falcons	Valla Valkyries		Sienna Johnson
	Deepwater Storm		Simon Boland
Ashbury Inferno	Ashbury Firehawks		Simpson Le
	UTS Lizards Teal		Song Poh Jun
Oakville Orcas	Oakhurst Orcas		Steph Luong
Banda Banda Pandas			Stephanie Kumar
Ashbury Inferno	Firefly Sirens		Stephanie Low
Elderslie Empyreans	Lilyfield Labubus	Cunningar Cheetahs	Stephanie Truong
	Manly Magicians	Liverpool Lightning	Stephen Mak
	Manly Magicians		Steven Tran
Lilli Pilli Lions	Limpinwood Lions	Cooneys Creek Cheetahs	Steven Zheng
	UTS Lizards Teal	Deepwater Storm	Suhag Gowda
Darkwood Immortals	Oakhurst Orcas		Sunny Kai-Chan
	Sefton Stunners		Tai Tagiiau
		Cunningar Cheetahs	Talanoa Solofoni
UTS Lizards	Chatswood Chibis	Duckmaloi Dreamers	Tan Rou En
Fairlight Ascendants	Sapphire Sirens		Tania Ho
Oakhurst Orcas	Oakhurst Orcas		Taz Kaluarachchi
UTS Lizards	UTS Lizards White		Tee Wei Hong
UTS Lizards	UTS Lizards White		Tee Yi Ching
Banda Banda Pandas	Diehard Darknights		Thompson Au
		Cooneys Creek Cheetahs	Tiana Zou
	UTS Lizards White		Tiancheng wang
	Razorback Raptors		Timmy Shevandin
Chatswood Chibis		Duckenfield Dreamers	Tony Huynh
	Five Dock Falcons		Trevor Jordan
Iluka Immortals	Kingswood Mavericks		Tristan Tran
	Razorback Raptors		Tyrone Crowley
Lilli Pilli Lions			Ushante Lancaster
Marsfield Meteors	Sefton Stunners		Vainikolo Toumoelupe
Banda Banda Pandas	Diehard Darknights		Vincent Lam
Canterbury Nines	Sefton Stunners	Canterbury Nines	Vincent Vu
Double Bay Dragonites	Manly Magicians	Liverpool Lightning	Vish Raman
Maison Dieu Mazoku	Firefly Sirens		Vivien Tse
	Manly Magicians		Wayne Tan
	Deepwater Storm		Will Koloamatangi
Maison Dieu Mazoku	Kingswood Mavericks	Duckenfield Dreamers	William Nguyen
Oakhurst Orcas	Oakhurst Orcas		Zaidi Afrani
	UTS Lizards White		Zhang Ziwei
	UTS Lizards Teal		Zi Yue Wong
	Five Dock Falcons		Zubin Bilimoria
    `
// Real tournament schedule data for testing
const REAL_SCHEDULE_DATA = `
Round	Division	Time	Home Team	Away Team	Court	Team Referee
SETUP		8:30	Canterbury Nines	Maison Dieu Mazoku	ALL	SETUP
Mixed Foam	MX2	9:30	Fairfield Falcons	UTS Lizards	1	Fairlight Ascendants
	MX2	9:30	Sun Valley Storm	Pan Ban Pandas	2	Oakhurst Orcas (MX)
	MX1	9:30	Oakville Orcas	Ashbury Inferno	3	Marsfield Meteors
	MX1	9:30	Elderslie Empyreans	Villawood Hydra	4	Iluka Immortals
	MX1	10:20	Maison Dieu Mazoku	Como Chaos	1	Elderslie Empyreans
	MX2	10:20	Canterbury Nines	Chatswood Chibis	2	Villawood Hydra
	MX2	10:20	Lilli Pilli Lions	Double Bay Dragonites	3	Sun Valley Storm (MX)
	MX2	10:20	Banda Banda Pandas	Ultimo Falcons	4	UTS Lizards
	MX1	11:10	Oakhurst Orcas	Darkwood Immortals	1	Lilli Pilli Lions
	MX1	11:10	Marsfield Meteors	Liverpool Lightning	2	Iluka Immortals
	MX1	11:10	Fairlight Ascendants	Iluka Immortals	3	Como Chaos
Gendered Foam	W	12:00	Arkstone Akuma	Lilyfield Labubus	1	Chatswood Chibis (W)
	M2	12:00	Sefton Stunners	Limpinwood Lions	2	UTS Lizards White
	M1	12:00	North Star Storm	Canterbury Nines	3	Kirribilli Kangaroos
	M1	12:00	Kingswood Mavericks	Liverpool Lightning	4	Auburn Ultras
	W	12:50	Oakhurst Orcas	Sapphire Sirens	1	Magenta Storm
	M2	12:50	Ashbury Firehawks	Warburn Wraiths	2	Kingswood Mavericks
	M2	12:50	Razorback Raptors	Sun Valley Storm	3	Sefton Stunners
	M2	12:50	Diehard Darknights	Deepwater Storm	4	Limpinwood Lions
	W	13:40	Chatswood Chibis	Valla Valkyries	1	Oakhurst Orcas (W)
	M2	13:40	Manly Magicians	UTS Lizards White	2	Razorback Raptors
	M1	13:40	Auburn Ultras	Kirribilli Kangaroos	3	Warburn Wraiths
	W	14:30	Darkwood Deathdealers	Magenta Storm	1	Valla Valkyries
	M1	14:30	Kingsford Mavericks	Oakhurst Orcas	2	Manly Magicians
	M2	14:30	UTS Lizards Teal	Five Dock Falcons	3	Sun Valley Storm (M)
Mixed Foam	MX1	15:20	Oakhurst Orcas	Iluka Immortals	1	Ashbury Inferno
	MX1	15:20	Elderslie Empyreans	Liverpool Lightning	2	North Star Storm (MX)
	MX2	15:20	Banda Banda Pandas	Double Bay Dragonites	3	UTS Lizards Teal
	MX2	15:20	Fairfield Falcons	Ultimo Falcons	4	Deepwater Storm
	MX2	16:10	Sun Valley Storm	Lilli Pilli Lions	1	Fairfield Falcons
	MX2	16:10	UTS Lizards	Pan Ban Pandas	2	Ultimo Falcons
	MX1	16:10	Marsfield Meteors	Darkwood Immortals	3	Elderslie Empyreans
	MX1	16:10	Oakville Orcas	Villawood Hydra	4	Double Bay Dragonites
	MX1	17:00	Ashbury Inferno	Como Chaos	1	Maison Dieu Mazoku
	MX1	17:00	Canterbury Nines	Fairlight Ascendants	2	Darkwood Immortals
	MX1	17:00	North Star Storm	Chatswood Chibis	3	Oakville Orcas
PACKING DOWN		17:40	Ashbury Inferno	Darkwood Immortals	ALL	PACKING DOWN
		Oakville Orcas	North Star Storm (MX)		`

// Helper function to parse player data similar to ImportPlayers.tsx
function parsePlayerData(playerDataString: string): { players: any[], teams: TeamsMap } {
  const lines = playerDataString.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('Invalid player data format');
  }

  const headers = lines[0].split('\t').map(h => h.trim());
  const dataRows = lines.slice(1);

  const players: any[] = [];

  dataRows.forEach(line => {
    const values = line.split('\t').map(v => v.trim());
    if (values.length >= 4) {
      const mixedTeam = values[0] || null;
      const genderedTeam = values[1] || null;
      const clothTeam = values[2] || null;
      const playerName = values[3] || '';

      if (playerName) {
        const player = new Player(
          playerName,
          mixedTeam,
          genderedTeam,
          clothTeam
        );
        players.push(player);
      }
    }
  });

  // Create teams from players using the same method as ImportPlayers.tsx
  const teams = Team.createTeamsFromPlayers(players);
  
  return { players, teams };
}

// Helper function to create teams map from schedule data, using real player data
function createTeamsFromSchedule(scheduleData: string): TeamsMap {
  // First, create teams from real player data
  const { teams } = parsePlayerData(REAL_PLAYER_DATA);
  
  // Then ensure all teams mentioned in the schedule exist
  const rows = parsePastedScheduleData(scheduleData);
  
  rows.forEach(row => {
    if (row.team1 && row.team2 && row.division) {
      // Skip special activities
      if (row.team1.includes('SETUP') || row.team1.includes('PACKING') || 
          row.team2.includes('SETUP') || row.team2.includes('PACKING')) {
        return;
      }

      const division = row.division.toLowerCase().includes('mx') ? 'mixed' : 
                      (row.division.toLowerCase().includes('w') || row.division.toLowerCase().includes('m')) ? 'gendered' : 'cloth';
      
      // Create team objects if they don't exist (with empty players array)
      if (!teams[division][row.team1]) {
        teams[division][row.team1] = new Team(row.team1, division, []);
      }
      if (!teams[division][row.team2]) {
        teams[division][row.team2] = new Team(row.team2, division, []);
      }
    }
  });

  return teams;
}

// Helper function to create schedule using ImportSchedule.tsx logic
function createScheduleFromPastedData(scheduleData: string): Schedule {
  const rows = parsePastedScheduleData(scheduleData)
  
  if (rows.length === 0) {
    throw new Error('No valid schedule data found')
  }

  // Create teams map first
  const teams = createTeamsFromSchedule(scheduleData)

  // Convert rows to CSV format (reusing ImportSchedule.tsx logic)
  const csvData = rows
    .map(row => {
      const round = row.round || ''
      const division = row.division || ''

      // Convert time format if needed (e.g., "9:30" to time slot number)
      let time = row.timeSlot || row.time || ''
      if (time.includes(':')) {
        const [hours, minutes] = time.split(':')
        time = `${parseInt(hours)}${minutes.padStart(2, '0')}`
      }

      const team1 = row.team1 || row.homeTeam || row.home || ''
      const team2 = row.team2 || row.awayTeam || row.away || ''
      const field = row.field || row.court || row.pitch || ''
      const referee = row.referee || row.refereeTeam || row.teamReferee || ''

      // Format: Round, Division, Time, Team1, Team2, Field, Referee
      return [round, division, time, team1, team2, field, referee].join(',')
    })
    .join('\n')

  // Use existing import logic
  const importedMatches = importSchedule(csvData, teams)

  if (importedMatches.length === 0) {
    throw new Error('No valid matches could be extracted from the data')
  }

  // Mark setup and packdown activities as locked (reusing ImportSchedule.tsx logic)
  importedMatches.forEach(match => {
    if (match.activityType === 'SETUP' || match.activityType === 'PACKING_DOWN') {
      match.locked = true
    }
  })

  return new Schedule(importedMatches)
}

// Helper function to create mock rules that will create violations
function createMockRules(): ScheduleRule[] {
 
  
  return [
            new AvoidBackToBackGames(3),
            new AvoidFirstAndLastGame(3),
            new AvoidReffingBeforePlaying(3),
            new LimitVenueTime(3),
            new EnsureFairFieldDistribution(3),
  ]
}

describe('Optimization Strategy Time Slot Integrity Tests', () => {
  let initialSchedule: Schedule
  let rules: ScheduleRule[]
  let initialTimeSlots: Set<number>

  beforeEach(() => {
    // Create schedule from real tournament data using ImportSchedule.tsx logic
    initialSchedule = createScheduleFromPastedData(REAL_SCHEDULE_DATA)
    rules = createMockRules()
    
    // Get the initial set of distinct time slots (filtering out null/undefined)
    initialTimeSlots = new Set(initialSchedule.matches.map(match => match.timeSlot).filter(slot => slot != null))
    
    console.log(`Initial time slots: ${Array.from(initialTimeSlots).sort((a, b) => a - b).join(', ')}`)
    console.log(`Total matches: ${initialSchedule.matches.length} (${initialSchedule.matches.filter(m => !m.isSpecialActivity?.()).length} regular, ${initialSchedule.matches.filter(m => m.isSpecialActivity?.()).length} special)`)
  })

  it('should preserve distinct time slots during optimization for all strategies', async () => {
    for (let i = 0; i < OPTIMIZATION_STRATEGIES.length; i++) {
      const strategy = OPTIMIZATION_STRATEGIES[i]
      const testSchedule = initialSchedule.deepCopy()
      const initialScore = testSchedule.evaluate(rules)
      
      console.log(`\n🔍 Testing ${strategy.name}...`)
      
      // Run optimization with sufficient iterations to test thoroughly
      const optimizedSchedule = await testSchedule.optimize(rules, 200, undefined, strategy)
      
      // Get the final set of distinct time slots (filtering out null/undefined)
      const finalTimeSlots = new Set(optimizedSchedule.matches.map(match => match.timeSlot).filter(slot => slot != null))
      
      console.log(`  Initial slots: ${Array.from(initialTimeSlots).sort((a, b) => a - b).join(', ')}`)
      console.log(`  Final slots: ${Array.from(finalTimeSlots).sort((a, b) => a - b).join(', ')}`)
      console.log(`  Score: ${initialScore} → ${optimizedSchedule.score} (${initialScore > optimizedSchedule.score ? 'IMPROVED' : 'SAME'})`)
      
      // Verify the distinct time slots are the same
      expect(finalTimeSlots).toEqual(initialTimeSlots)
      
      // Verify total number of matches is preserved
      expect(optimizedSchedule.matches.length).toBe(initialSchedule.matches.length)
      
      // Verify special activities are preserved and unchanged
      const initialSpecialActivities = initialSchedule.matches.filter(m => m.isSpecialActivity?.())
      const finalSpecialActivities = optimizedSchedule.matches.filter(m => m.isSpecialActivity?.())
      
      expect(finalSpecialActivities.length).toBe(initialSpecialActivities.length)
      
      // Verify special activities maintain their original time slots
      initialSpecialActivities.forEach(original => {
        const corresponding = finalSpecialActivities.find(final => 
          final.team1?.name === original.team1?.name && 
          final.team2?.name === original.team2?.name &&
          final.activityType === original.activityType
        )
        expect(corresponding).toBeDefined()
        expect(corresponding?.timeSlot).toBe(original.timeSlot)
        expect(corresponding?.field).toBe(original.field)
      })
    }
  })
}) 