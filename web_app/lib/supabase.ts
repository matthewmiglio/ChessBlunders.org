import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Types for database tables
export interface Profile {
  id: string;
  chess_username: string | null;
  created_at: string;
  updated_at: string;
}

export interface Game {
  id: string;
  user_id: string;
  chess_game_id: string;
  pgn: string;
  opponent: string | null;
  user_color: "white" | "black" | null;
  time_class: string | null;
  rated: boolean;
  result: string | null;
  played_at: string | null;
  created_at: string;
}

export interface Blunder {
  move_number: number;
  fen: string;
  move_played: string;
  best_move: string;
  eval_before: number;
  eval_after: number;
  eval_drop: number;
}

export interface Analysis {
  id: string;
  game_id: string;
  user_id: string;
  blunders: Blunder[];
  threshold_cp: number;
  analyzed_at: string;
}

export interface EngineUsage {
  id: string;
  user_id: string;
  requests_today: number;
  last_request_at: string | null;
  last_reset_date: string;
  total_requests: number;
  created_at: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  analysis_id: string;
  blunder_index: number;
  solved: boolean;
  attempts: number;
  solved_at: string | null;
  created_at: string;
}

// Password validation
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (password.length > 72) {
    errors.push("Password must be at most 72 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return { valid: errors.length === 0, errors };
}
