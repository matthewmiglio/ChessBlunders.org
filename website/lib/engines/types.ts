export interface EngineInfo {
  id: string;
  name: string;
  description: string;
  needsCrossOriginIsolation?: boolean;
}

export interface IterationInfo {
  depth: number;
  scoreCp?: number;
  mateIn?: number;
  pv?: string[];
  nodes?: number;
  nps?: number;
  elapsedMs: number;
}

export interface SearchLimits {
  depth?: number;
  movetime?: number;
  /** Number of principal variations to compute (UCI MultiPV). Defaults to 1. */
  multipv?: number;
  onIteration?: (info: IterationInfo) => void;
}

export interface PvLine {
  multipv: number;
  depth: number;
  scoreCp?: number;
  mateIn?: number;
  pv?: string[];
}

export interface SearchResult {
  bestmove: string;
  scoreCp?: number;
  mateIn?: number;
  depth?: number;
  nodes?: number;
  nps?: number;
  elapsedMs: number;
  pv?: string[];
  /** One entry per requested PV when multipv > 1, ordered best-first. */
  lines?: PvLine[];
}

export interface Engine {
  readonly info: EngineInfo;
  ready(): Promise<void>;
  search(fen: string, limits: SearchLimits): Promise<SearchResult>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}

export type EngineFactory = () => Engine;
