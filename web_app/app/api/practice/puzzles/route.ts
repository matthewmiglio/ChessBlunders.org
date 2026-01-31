import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { Blunder, Game } from "@/lib/supabase";
import {
  PuzzleFilters,
  FilterCounts,
  getGamePhase,
  getSeverity,
  getPieceType,
  getResultCategory,
  getTimeControlCategory,
  getOpeningFamily,
  isWithinDateRange,
} from "@/lib/puzzle-filters";

interface AnalysisWithGame {
  id: string;
  blunders: Blunder[];
  game: Game | null;
}

interface ProgressRecord {
  analysis_id: string;
  blunder_index: number;
  solved: boolean;
  attempts: number;
  practice_run: number;
}

export interface Puzzle {
  id: string; // format: "analysisId:blunderIndex"
  analysisId: string;
  blunderIndex: number;
  blunder: Blunder;
  game: Game | null;
  solved: boolean;
  attempts: number;
  // Computed filter values
  phase: string;
  severity: string;
  pieceType: string;
  resultCategory: string;
  timeControl: string;
  openingFamily: string;
}

// GET /api/practice/puzzles - Get filtered puzzles
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;

  // Parse filter params
  const filters: PuzzleFilters = {
    phase: searchParams.get("phase") as PuzzleFilters["phase"] || undefined,
    severity: searchParams.get("severity") as PuzzleFilters["severity"] || undefined,
    timeControl: searchParams.get("timeControl") as PuzzleFilters["timeControl"] || undefined,
    color: searchParams.get("color") as PuzzleFilters["color"] || undefined,
    result: searchParams.get("result") as PuzzleFilters["result"] || undefined,
    pieceType: searchParams.get("pieceType") as PuzzleFilters["pieceType"] || undefined,
    dateRange: searchParams.get("dateRange") as PuzzleFilters["dateRange"] || undefined,
    openingFamily: searchParams.get("openingFamily") as PuzzleFilters["openingFamily"] || undefined,
    solved: searchParams.get("solved") === "true" ? true : searchParams.get("solved") === "false" ? false : undefined,
  };

  try {
    // Fetch analyses with joined game data
    const { data: analyses, error: analysesError } = await supabase
      .from("analysis")
      .select(`
        id,
        blunders,
        game:games (
          id,
          time_class,
          user_color,
          result,
          played_at,
          pgn,
          opponent
        )
      `)
      .eq("user_id", user.id);

    if (analysesError) {
      return NextResponse.json({ error: analysesError.message }, { status: 500 });
    }

    // Get current practice run from user's profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("current_practice_run")
      .eq("id", user.id)
      .single();

    const profileRun = profileData?.current_practice_run || 1;

    // Fetch ALL user progress records (we'll filter by run after checking what exists)
    const { data: allProgressData, error: progressError } = await supabase
      .from("user_progress")
      .select("analysis_id, blunder_index, solved, attempts, practice_run")
      .eq("user_id", user.id);

    // Find the actual run that has data - use profile run if it has data, otherwise find the max run with data
    const runsWithData = new Set((allProgressData || []).map(r => r.practice_run).filter(r => r != null));
    let currentRun = profileRun;

    // If the profile's run has no data, use the highest run that does have data
    if (!runsWithData.has(profileRun) && runsWithData.size > 0) {
      currentRun = Math.max(...Array.from(runsWithData));
    }

    // Filter to current run (or NULL for legacy)
    const progressData = (allProgressData || []).filter(
      (r: ProgressRecord) => r.practice_run === currentRun || r.practice_run == null
    );

    if (progressError) {
      return NextResponse.json({ error: progressError.message }, { status: 500 });
    }

    // Create a map for quick progress lookup
    const progressMap = new Map<string, ProgressRecord>();
    (progressData || []).forEach((p: ProgressRecord) => {
      const key = `${p.analysis_id}:${p.blunder_index}`;
      progressMap.set(key, p);
    });

    // Flatten blunders into puzzles
    const allPuzzles: Puzzle[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (analyses || []).forEach((rawAnalysis: any) => {
      // Handle Supabase join returning game as array
      const analysis: AnalysisWithGame = {
        id: rawAnalysis.id,
        blunders: rawAnalysis.blunders,
        game: Array.isArray(rawAnalysis.game) ? rawAnalysis.game[0] || null : rawAnalysis.game,
      };
      if (!analysis.blunders || analysis.blunders.length === 0) return;

      analysis.blunders.forEach((blunder: Blunder, index: number) => {
        const progressKey = `${analysis.id}:${index}`;
        const progress = progressMap.get(progressKey);

        const puzzle: Puzzle = {
          id: progressKey,
          analysisId: analysis.id,
          blunderIndex: index,
          blunder,
          game: analysis.game,
          solved: progress?.solved || false,
          attempts: progress?.attempts || 0,
          // Compute filter values
          phase: getGamePhase(blunder.move_number),
          severity: getSeverity(blunder.eval_drop),
          pieceType: getPieceType(blunder.move_played),
          resultCategory: getResultCategory(analysis.game?.result || null),
          timeControl: getTimeControlCategory(analysis.game?.time_class || null),
          openingFamily: getOpeningFamily(analysis.game?.pgn || null),
        };

        allPuzzles.push(puzzle);
      });
    });

    // Calculate counts before filtering
    const counts = calculateCounts(allPuzzles);

    // Apply filters
    const filteredPuzzles = allPuzzles.filter((puzzle) => {
      // Phase filter
      if (filters.phase && puzzle.phase !== filters.phase) return false;

      // Severity filter
      if (filters.severity && puzzle.severity !== filters.severity) return false;

      // Time control filter
      if (filters.timeControl && puzzle.timeControl !== filters.timeControl) return false;

      // Color filter
      if (filters.color && puzzle.game?.user_color !== filters.color) return false;

      // Result filter
      if (filters.result && puzzle.resultCategory !== filters.result) return false;

      // Piece type filter
      if (filters.pieceType && puzzle.pieceType !== filters.pieceType) return false;

      // Date range filter
      if (filters.dateRange && !isWithinDateRange(puzzle.game?.played_at || null, filters.dateRange)) return false;

      // Opening family filter
      if (filters.openingFamily && puzzle.openingFamily !== filters.openingFamily) return false;

      // Solved filter
      if (filters.solved !== undefined && puzzle.solved !== filters.solved) return false;

      return true;
    });

    return NextResponse.json({
      puzzles: filteredPuzzles,
      total: allPuzzles.length,
      filtered: filteredPuzzles.length,
      counts,
      currentPracticeRun: currentRun,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch puzzles" },
      { status: 500 }
    );
  }
}

function calculateCounts(puzzles: Puzzle[]): FilterCounts {
  const counts: FilterCounts = {
    // Phase
    opening: 0,
    middlegame: 0,
    endgame: 0,
    // Severity
    minor: 0,
    medium: 0,
    major: 0,
    // Time control
    bullet: 0,
    blitz: 0,
    rapid: 0,
    classical: 0,
    // Color
    white: 0,
    black: 0,
    // Result
    win: 0,
    loss: 0,
    draw: 0,
    // Piece type
    pawn: 0,
    knight: 0,
    bishop: 0,
    rook: 0,
    queen: 0,
    king: 0,
    // Date range
    week: 0,
    month: 0,
    '3months': 0,
    year: 0,
    all: puzzles.length,
    // Opening family
    e4: 0,
    d4: 0,
    c4: 0,
    nf3: 0,
    other: 0,
    // Solved
    solvedCount: 0,
    unsolvedCount: 0,
  };

  puzzles.forEach((puzzle) => {
    // Phase
    counts[puzzle.phase as keyof FilterCounts]++;

    // Severity
    counts[puzzle.severity as keyof FilterCounts]++;

    // Time control
    counts[puzzle.timeControl as keyof FilterCounts]++;

    // Color
    if (puzzle.game?.user_color) {
      counts[puzzle.game.user_color as keyof FilterCounts]++;
    }

    // Result
    counts[puzzle.resultCategory as keyof FilterCounts]++;

    // Piece type
    counts[puzzle.pieceType as keyof FilterCounts]++;

    // Date range
    if (isWithinDateRange(puzzle.game?.played_at || null, 'week')) counts.week++;
    if (isWithinDateRange(puzzle.game?.played_at || null, 'month')) counts.month++;
    if (isWithinDateRange(puzzle.game?.played_at || null, '3months')) counts['3months']++;
    if (isWithinDateRange(puzzle.game?.played_at || null, 'year')) counts.year++;

    // Opening family
    counts[puzzle.openingFamily as keyof FilterCounts]++;

    // Solved
    if (puzzle.solved) {
      counts.solvedCount++;
    } else {
      counts.unsolvedCount++;
    }
  });

  return counts;
}
