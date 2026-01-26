// Puzzle filter types and helper functions

export type GamePhase = 'opening' | 'middlegame' | 'endgame';
export type Severity = 'minor' | 'medium' | 'major';
export type TimeControl = 'bullet' | 'blitz' | 'rapid' | 'classical';
export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type ResultCategory = 'win' | 'loss' | 'draw';
export type OpeningFamily = 'e4' | 'd4' | 'c4' | 'nf3' | 'other';
export type DateRange = 'week' | 'month' | '3months' | 'year' | 'all';

export interface PuzzleFilters {
  phase?: GamePhase;
  severity?: Severity;
  timeControl?: TimeControl;
  color?: 'white' | 'black';
  result?: ResultCategory;
  pieceType?: PieceType;
  dateRange?: DateRange;
  openingFamily?: OpeningFamily;
  solved?: boolean;
}

export interface FilterCounts {
  // Phase counts
  opening: number;
  middlegame: number;
  endgame: number;
  // Severity counts
  minor: number;
  medium: number;
  major: number;
  // Time control counts
  bullet: number;
  blitz: number;
  rapid: number;
  classical: number;
  // Color counts
  white: number;
  black: number;
  // Result counts
  win: number;
  loss: number;
  draw: number;
  // Piece type counts
  pawn: number;
  knight: number;
  bishop: number;
  rook: number;
  queen: number;
  king: number;
  // Date range counts
  week: number;
  month: number;
  '3months': number;
  year: number;
  all: number;
  // Opening family counts
  e4: number;
  d4: number;
  c4: number;
  nf3: number;
  other: number;
  // Solved counts
  solvedCount: number;
  unsolvedCount: number;
}

// Helper functions

export function getGamePhase(moveNumber: number): GamePhase {
  if (moveNumber <= 15) return 'opening';
  if (moveNumber <= 35) return 'middlegame';
  return 'endgame';
}

export function getSeverity(evalDrop: number): Severity {
  if (evalDrop < 200) return 'minor';
  if (evalDrop < 400) return 'medium';
  return 'major';
}

export function getPieceType(move: string): PieceType {
  if (!move) return 'pawn';
  if (move.startsWith('O-O')) return 'king'; // Castling
  const firstChar = move[0];
  switch (firstChar) {
    case 'N': return 'knight';
    case 'B': return 'bishop';
    case 'R': return 'rook';
    case 'Q': return 'queen';
    case 'K': return 'king';
    default: return 'pawn'; // Lowercase letter = pawn move
  }
}

export function getResultCategory(result: string | null): ResultCategory {
  if (!result) return 'loss';
  if (result === 'win') return 'win';
  if (['draw', 'stalemate', 'repetition', 'insufficient', '50move', 'agreed'].includes(result)) {
    return 'draw';
  }
  return 'loss';
}

export function getTimeControlCategory(timeClass: string | null): TimeControl {
  if (!timeClass) return 'rapid';
  if (timeClass === 'bullet') return 'bullet';
  if (timeClass === 'blitz') return 'blitz';
  if (timeClass === 'rapid') return 'rapid';
  // daily, classical, etc. are considered classical
  return 'classical';
}

export function getOpeningFamily(pgn: string | null): OpeningFamily {
  if (!pgn) return 'other';
  // Extract first move from PGN
  const moveMatch = pgn.match(/1\.\s*(\S+)/);
  if (!moveMatch) return 'other';

  const firstMove = moveMatch[1];
  if (firstMove === 'e4') return 'e4';
  if (firstMove === 'd4') return 'd4';
  if (firstMove === 'c4') return 'c4';
  if (firstMove === 'Nf3') return 'nf3';
  return 'other';
}

export function isWithinDateRange(playedAt: string | null, range: DateRange): boolean {
  if (range === 'all') return true;
  if (!playedAt) return false;

  const now = new Date();
  const playedDate = new Date(playedAt);
  const diffMs = now.getTime() - playedDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  switch (range) {
    case 'week': return diffDays <= 7;
    case 'month': return diffDays <= 30;
    case '3months': return diffDays <= 90;
    case 'year': return diffDays <= 365;
    default: return true;
  }
}

// Filter display labels
export const filterLabels = {
  phase: {
    opening: 'Opening',
    middlegame: 'Middlegame',
    endgame: 'Endgame',
  },
  severity: {
    minor: 'Minor',
    medium: 'Medium',
    major: 'Major',
  },
  timeControl: {
    bullet: 'Bullet',
    blitz: 'Blitz',
    rapid: 'Rapid',
    classical: 'Classical',
  },
  color: {
    white: 'White',
    black: 'Black',
  },
  result: {
    win: 'Won',
    loss: 'Lost',
    draw: 'Draw',
  },
  pieceType: {
    pawn: 'Pawn',
    knight: 'Knight',
    bishop: 'Bishop',
    rook: 'Rook',
    queen: 'Queen',
    king: 'King',
  },
  dateRange: {
    week: 'Last Week',
    month: 'Last Month',
    '3months': 'Last 3 Months',
    year: 'Last Year',
    all: 'All Time',
  },
  openingFamily: {
    e4: '1.e4',
    d4: '1.d4',
    c4: '1.c4 (English)',
    nf3: '1.Nf3 (Reti)',
    other: 'Other',
  },
} as const;
