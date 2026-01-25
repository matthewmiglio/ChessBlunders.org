"""
Stockfish interface - supports both local engine and cloud API.

Usage:
    # Local engine
    engine = StockfishInterface(mode="local", path="path/to/stockfish")

    # Cloud API
    engine = StockfishInterface(mode="cloud", url="https://your-api.com")

    # Analyze
    result = engine.analyze("fen string", time=0.3, multipv=3)

    # Evaluate move
    result = engine.evaluate("fen string", "e2e4")
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import chess
import chess.engine


@dataclass
class MoveAnalysis:
    """Result of analyzing a single move option."""
    move_uci: str
    move_san: str
    eval_cp: Optional[int] = None
    mate_in: Optional[int] = None


@dataclass
class PositionAnalysis:
    """Result of analyzing a position."""
    fen: str
    side_to_move: str
    best_moves: list[MoveAnalysis]


@dataclass
class MoveEvaluation:
    """Result of evaluating a specific move."""
    fen: str
    move_uci: str
    move_san: str
    is_legal: bool
    eval_before_cp: Optional[int] = None
    eval_after_cp: Optional[int] = None
    eval_drop_cp: Optional[int] = None
    best_move_uci: Optional[str] = None
    best_move_san: Optional[str] = None


class StockfishBackend(ABC):
    """Abstract base class for Stockfish backends."""

    @abstractmethod
    def analyze(self, fen: str, time: float = 0.3, depth: Optional[int] = None, multipv: int = 3) -> PositionAnalysis:
        """Analyze a position and return best moves."""
        pass

    @abstractmethod
    def evaluate(self, fen: str, move: str, time: float = 0.3) -> MoveEvaluation:
        """Evaluate a specific move in a position."""
        pass

    @abstractmethod
    def close(self):
        """Clean up resources."""
        pass


class LocalStockfish(StockfishBackend):
    """Local Stockfish engine via UCI."""

    def __init__(self, path: str, threads: int = 4, hash_mb: int = 256):
        self.engine = chess.engine.SimpleEngine.popen_uci(path)
        self.engine.configure({"Threads": threads, "Hash": hash_mb})

    def _get_eval(self, score: chess.engine.PovScore, turn: chess.Color) -> tuple[Optional[int], Optional[int]]:
        """Extract centipawn eval and mate score."""
        pov_score = score.white()
        if pov_score.is_mate():
            mate_in = pov_score.mate()
            return None, mate_in
        else:
            cp = pov_score.score()
            if turn == chess.BLACK:
                cp = -cp
            return cp, None

    def analyze(self, fen: str, time: float = 0.3, depth: Optional[int] = None, multipv: int = 3) -> PositionAnalysis:
        board = chess.Board(fen)

        if depth:
            limit = chess.engine.Limit(depth=depth)
        else:
            limit = chess.engine.Limit(time=time)

        analysis = self.engine.analyse(board, limit, multipv=multipv)

        best_moves = []
        for info in analysis:
            if "pv" not in info or not info["pv"]:
                continue

            move = info["pv"][0]
            score = info.get("score")

            eval_cp, mate_in = None, None
            if score:
                eval_cp, mate_in = self._get_eval(score, board.turn)

            best_moves.append(MoveAnalysis(
                move_uci=move.uci(),
                move_san=board.san(move),
                eval_cp=eval_cp,
                mate_in=mate_in
            ))

        return PositionAnalysis(
            fen=fen,
            side_to_move="white" if board.turn == chess.WHITE else "black",
            best_moves=best_moves
        )

    def evaluate(self, fen: str, move_uci: str, time: float = 0.3) -> MoveEvaluation:
        board = chess.Board(fen)

        try:
            move = chess.Move.from_uci(move_uci)
        except ValueError:
            return MoveEvaluation(fen=fen, move_uci=move_uci, move_san=move_uci, is_legal=False)

        if move not in board.legal_moves:
            return MoveEvaluation(fen=fen, move_uci=move_uci, move_san=move_uci, is_legal=False)

        move_san = board.san(move)
        limit = chess.engine.Limit(time=time)

        # Analyze before
        before = self.engine.analyse(board, limit, multipv=1)
        before_score = before[0].get("score") if before else None
        best_move = before[0]["pv"][0] if before and "pv" in before[0] else None

        eval_before_cp, _ = self._get_eval(before_score, board.turn) if before_score else (None, None)
        best_move_uci = best_move.uci() if best_move else None
        best_move_san = board.san(best_move) if best_move else None

        # Make move and analyze after
        board.push(move)
        after = self.engine.analyse(board, limit, multipv=1)
        after_score = after[0].get("score") if after else None
        eval_after_cp, _ = self._get_eval(after_score, board.turn) if after_score else (None, None)

        # Negate because opponent's perspective
        if eval_after_cp is not None:
            eval_after_cp = -eval_after_cp

        # Calculate drop
        eval_drop_cp = None
        if eval_before_cp is not None and eval_after_cp is not None:
            eval_drop_cp = eval_before_cp - eval_after_cp

        return MoveEvaluation(
            fen=fen,
            move_uci=move_uci,
            move_san=move_san,
            is_legal=True,
            eval_before_cp=eval_before_cp,
            eval_after_cp=eval_after_cp,
            eval_drop_cp=eval_drop_cp,
            best_move_uci=best_move_uci,
            best_move_san=best_move_san
        )

    def close(self):
        if self.engine:
            self.engine.quit()


class CloudStockfish(StockfishBackend):
    """Cloud Stockfish API client."""

    def __init__(self, url: str, timeout: int = 30):
        import requests
        self.url = url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()

    def analyze(self, fen: str, time: float = 0.3, depth: Optional[int] = None, multipv: int = 3) -> PositionAnalysis:
        payload = {"fen": fen, "multipv": multipv}
        if depth:
            payload["depth"] = depth
        else:
            payload["time"] = time

        response = self.session.post(f"{self.url}/analyze", json=payload, timeout=self.timeout)
        response.raise_for_status()
        data = response.json()

        best_moves = [
            MoveAnalysis(
                move_uci=m["move_uci"],
                move_san=m["move_san"],
                eval_cp=m.get("eval_cp"),
                mate_in=m.get("mate_in")
            )
            for m in data["best_moves"]
        ]

        return PositionAnalysis(
            fen=data["fen"],
            side_to_move=data["side_to_move"],
            best_moves=best_moves
        )

    def evaluate(self, fen: str, move_uci: str, time: float = 0.3) -> MoveEvaluation:
        payload = {"fen": fen, "move": move_uci, "time": time}

        response = self.session.post(f"{self.url}/evaluate", json=payload, timeout=self.timeout)
        response.raise_for_status()
        data = response.json()

        return MoveEvaluation(
            fen=data["fen"],
            move_uci=data["move_uci"],
            move_san=data["move_san"],
            is_legal=data["is_legal"],
            eval_before_cp=data.get("eval_before_cp"),
            eval_after_cp=data.get("eval_after_cp"),
            eval_drop_cp=data.get("eval_drop_cp"),
            best_move_uci=data.get("best_move_uci"),
            best_move_san=data.get("best_move_san")
        )

    def close(self):
        self.session.close()


class StockfishInterface:
    """
    Unified interface for Stockfish - works with both local and cloud backends.
    """

    def __init__(
        self,
        mode: str = "local",
        path: Optional[str] = None,
        url: Optional[str] = None,
        threads: int = 4,
        hash_mb: int = 256,
        timeout: int = 30
    ):
        """
        Initialize Stockfish interface.

        Args:
            mode: "local" or "cloud"
            path: Path to local Stockfish binary (required for local mode)
            url: URL of cloud API (required for cloud mode)
            threads: Number of threads for local engine
            hash_mb: Hash table size in MB for local engine
            timeout: Request timeout for cloud API
        """
        self.mode = mode

        if mode == "local":
            if not path:
                raise ValueError("path required for local mode")
            self.backend = LocalStockfish(path, threads, hash_mb)
        elif mode == "cloud":
            if not url:
                raise ValueError("url required for cloud mode")
            self.backend = CloudStockfish(url, timeout)
        else:
            raise ValueError(f"Invalid mode: {mode}. Use 'local' or 'cloud'")

    def analyze(self, fen: str, time: float = 0.3, depth: Optional[int] = None, multipv: int = 3) -> PositionAnalysis:
        """Analyze a position and return best moves."""
        return self.backend.analyze(fen, time, depth, multipv)

    def evaluate(self, fen: str, move: str, time: float = 0.3) -> MoveEvaluation:
        """Evaluate a specific move."""
        return self.backend.evaluate(fen, move, time)

    def close(self):
        """Clean up resources."""
        self.backend.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


# Default paths - set STOCKFISH_PATH environment variable or pass path directly
import os
DEFAULT_LOCAL_PATH = os.environ.get("STOCKFISH_PATH", "stockfish")
DEFAULT_CLOUD_URL = os.environ.get("STOCKFISH_API_URL", "http://localhost:8000")


def get_local_engine(path: str = DEFAULT_LOCAL_PATH, **kwargs) -> StockfishInterface:
    """Get a local Stockfish engine."""
    return StockfishInterface(mode="local", path=path, **kwargs)


def get_cloud_engine(url: str = DEFAULT_CLOUD_URL, **kwargs) -> StockfishInterface:
    """Get a cloud Stockfish engine."""
    return StockfishInterface(mode="cloud", url=url, **kwargs)


if __name__ == "__main__":
    # Quick test
    print("Testing local engine...")
    with get_local_engine() as engine:
        result = engine.analyze("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", time=0.2)
        print(f"Best moves: {[m.move_san for m in result.best_moves]}")

        eval_result = engine.evaluate("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e2e4")
        print(f"e4 eval drop: {eval_result.eval_drop_cp}cp")
