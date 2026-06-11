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
  onIteration?: (info: IterationInfo) => void;
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
}

export interface Engine {
  readonly info: EngineInfo;
  ready(): Promise<void>;
  search(fen: string, limits: SearchLimits): Promise<SearchResult>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}

export type EngineFactory = () => Engine;
