import { createStockfishNnue } from "./stockfish-nnue";
import type { Engine, EngineInfo } from "./types";

export const STOCKFISH_NNUE: EngineInfo = {
  id: "stockfish-nnue",
  name: "Stockfish NNUE (multithreaded WASM)",
  description: "Stockfish 16 NNUE — multithreaded + SIMD + full NNUE. Requires cross-origin isolation.",
  needsCrossOriginIsolation: true,
};

export function createEngine(): Engine {
  return createStockfishNnue();
}
