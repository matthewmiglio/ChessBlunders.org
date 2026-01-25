"""
Test engine analysis of games - find blunders and correct moves.

Requires Stockfish to be installed and accessible.
"""

import json
from dataclasses import dataclass, asdict
from pathlib import Path

import chess
import chess.engine
import chess.pgn
import pytest
from io import StringIO

import os

DATA_DIR = Path(__file__).parent.parent / "data"
GAMES_DIR = DATA_DIR / "games"
ANALYZED_DIR = DATA_DIR / "analyzed_games"

# Set STOCKFISH_PATH environment variable or ensure stockfish is in PATH
STOCKFISH_PATH = os.environ.get("STOCKFISH_PATH", "stockfish")

BLUNDER_THRESHOLD_CP = 100
MULTIPV = 3
ANALYSIS_TIME = 0.3


@dataclass
class MoveAnalysis:
    """Analysis result for a single move."""
    ply: int
    move_number: int
    side: str
    fen_before: str
    played_move_uci: str
    played_move_san: str
    best_move_uci: str
    best_move_san: str
    eval_before_cp: int
    eval_after_cp: int
    drop_cp: int
    is_blunder: bool
    acceptable_moves: list[dict]


@dataclass
class BlunderPuzzle:
    """A blunder puzzle for training."""
    id: str
    game_url: str
    fen: str
    side_to_move: str
    move_number: int
    played_move_uci: str
    played_move_san: str
    correct_move_uci: str
    correct_move_san: str
    eval_drop_cp: int
    acceptable_moves: list[dict]


def parse_pgn(pgn_string: str) -> chess.pgn.Game | None:
    """Parse a PGN string into a game object."""
    try:
        return chess.pgn.read_game(StringIO(pgn_string))
    except Exception as e:
        print(f"Failed to parse PGN: {e}")
        return None


def get_eval_cp(info: chess.engine.InfoDict, turn: chess.Color) -> int:
    """
    Extract centipawn evaluation from engine info.
    Normalizes to the perspective of the side to move.
    """
    score = info.get("score")
    if score is None:
        return 0

    pov_score = score.white()

    if pov_score.is_mate():
        mate_in = pov_score.mate()
        if mate_in > 0:
            cp = 100000 - (mate_in * 100)
        else:
            cp = -100000 - (mate_in * 100)
    else:
        cp = pov_score.score()

    if turn == chess.BLACK:
        cp = -cp

    return cp


def analyze_position(
    engine: chess.engine.SimpleEngine,
    board: chess.Board,
    time_limit: float = ANALYSIS_TIME,
    multipv: int = MULTIPV
) -> list[dict]:
    """
    Analyze a position and return top moves with evaluations.

    Returns list of {move_uci, move_san, eval_cp}
    """
    results = []

    analysis = engine.analyse(
        board,
        chess.engine.Limit(time=time_limit),
        multipv=multipv
    )

    for info in analysis:
        if "pv" not in info or not info["pv"]:
            continue

        move = info["pv"][0]
        eval_cp = get_eval_cp(info, board.turn)

        results.append({
            "move_uci": move.uci(),
            "move_san": board.san(move),
            "eval_cp": eval_cp
        })

    return results


def analyze_game(
    game: chess.pgn.Game,
    engine: chess.engine.SimpleEngine,
    username: str,
    game_url: str = ""
) -> tuple[list[MoveAnalysis], list[BlunderPuzzle]]:
    """
    Analyze all moves in a game for the specified user.

    Returns:
        - List of all move analyses for the user
        - List of blunder puzzles
    """
    board = game.board()

    white_player = game.headers.get("White", "").lower()
    black_player = game.headers.get("Black", "").lower()
    username_lower = username.lower()

    if username_lower == white_player:
        user_color = chess.WHITE
    elif username_lower == black_player:
        user_color = chess.BLACK
    else:
        print(f"Username {username} not found in game players: {white_player} vs {black_player}")
        return [], []

    analyses = []
    blunders = []

    for ply, move in enumerate(game.mainline_moves()):
        if board.turn != user_color:
            board.push(move)
            continue

        move_number = board.fullmove_number
        fen_before = board.fen()
        side = "white" if board.turn == chess.WHITE else "black"

        top_moves = analyze_position(engine, board)

        if not top_moves:
            board.push(move)
            continue

        best_eval = top_moves[0]["eval_cp"]
        best_move = top_moves[0]

        board_copy = chess.Board(fen_before)
        played_move_san = board_copy.san(move)
        board_copy.push(move)

        post_analysis = engine.analyse(
            board_copy,
            chess.engine.Limit(time=ANALYSIS_TIME)
        )
        played_eval = -get_eval_cp(post_analysis, board_copy.turn)

        drop_cp = best_eval - played_eval

        is_blunder = drop_cp >= BLUNDER_THRESHOLD_CP

        acceptable = [m for m in top_moves if (best_eval - m["eval_cp"]) < BLUNDER_THRESHOLD_CP]

        analysis = MoveAnalysis(
            ply=ply,
            move_number=move_number,
            side=side,
            fen_before=fen_before,
            played_move_uci=move.uci(),
            played_move_san=played_move_san,
            best_move_uci=best_move["move_uci"],
            best_move_san=best_move["move_san"],
            eval_before_cp=best_eval,
            eval_after_cp=played_eval,
            drop_cp=drop_cp,
            is_blunder=is_blunder,
            acceptable_moves=acceptable
        )
        analyses.append(analysis)

        board.push(move)

        if is_blunder:
            puzzle = BlunderPuzzle(
                id=f"{game_url}_{ply}" if game_url else f"puzzle_{ply}",
                game_url=game_url,
                fen=fen_before,
                side_to_move=side,
                move_number=move_number,
                played_move_uci=move.uci(),
                played_move_san=played_move_san,
                correct_move_uci=best_move["move_uci"],
                correct_move_san=best_move["move_san"],
                eval_drop_cp=drop_cp,
                acceptable_moves=acceptable
            )
            blunders.append(puzzle)
            print(f"  Blunder found: move {move_number}. {played_move_san} (drop: {drop_cp}cp) - should be {best_move['move_san']}")

    return analyses, blunders


def extract_game_id(game_url: str) -> str:
    """Extract game ID from Chess.com URL."""
    # URL format: https://www.chess.com/game/live/147461995910
    if "/" in game_url:
        return game_url.rstrip("/").split("/")[-1]
    return game_url


def save_game_analysis(username: str, game_id: str, game_data: dict, analyses: list, blunders: list) -> Path:
    """Save analysis for a single game to data/analyzed_games/{username}/{game_id}.json."""
    user_dir = ANALYZED_DIR / username
    user_dir.mkdir(parents=True, exist_ok=True)

    output_file = user_dir / f"{game_id}.json"

    result = {
        "game_id": game_id,
        "game_url": game_data.get("url", ""),
        "time_class": game_data.get("time_class", ""),
        "rated": game_data.get("rated", False),
        "white": game_data.get("white", {}).get("username", ""),
        "black": game_data.get("black", {}).get("username", ""),
        "user_color": "white" if game_data.get("white", {}).get("username", "").lower() == username.lower() else "black",
        "blunder_threshold_cp": BLUNDER_THRESHOLD_CP,
        "moves_analyzed": len(analyses),
        "blunders_found": len(blunders),
        "analyses": [asdict(a) for a in analyses],
        "blunders": [asdict(b) for b in blunders]
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    return output_file


def analyze_games_file(
    games_file: Path,
    engine_path: str = STOCKFISH_PATH,
    max_games: int | None = None
) -> dict:
    """
    Analyze all games in a saved games file.
    Saves each game's analysis to a separate file.

    Returns summary dict.
    """
    with open(games_file) as f:
        data = json.load(f)

    username = data["username"]
    games = data["games"]

    if max_games:
        games = games[:max_games]

    total_moves = 0
    total_blunders = 0
    saved_files = []

    with chess.engine.SimpleEngine.popen_uci(engine_path) as engine:
        engine.configure({"Threads": 4, "Hash": 256})

        for i, game_data in enumerate(games):
            pgn_string = game_data.get("pgn")
            if not pgn_string:
                continue

            game = parse_pgn(pgn_string)
            if not game:
                continue

            game_url = game_data.get("url", f"game_{i}")
            game_id = extract_game_id(game_url)
            print(f"Analyzing game {i+1}/{len(games)}: {game_url}")

            analyses, blunders = analyze_game(game, engine, username, game_url)

            output_file = save_game_analysis(username, game_id, game_data, analyses, blunders)
            saved_files.append(str(output_file))

            total_moves += len(analyses)
            total_blunders += len(blunders)

            print(f"  Saved to {output_file}")

    return {
        "username": username,
        "games_analyzed": len(games),
        "total_moves_analyzed": total_moves,
        "blunders_found": total_blunders,
        "saved_files": saved_files
    }


class TestPGNParsing:
    """Tests for PGN parsing."""

    def test_parse_simple_pgn(self):
        """Test parsing a simple PGN."""
        pgn = """[Event "Test"]
[White "Player1"]
[Black "Player2"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *"""

        game = parse_pgn(pgn)
        assert game is not None
        assert game.headers["White"] == "Player1"

        moves = list(game.mainline_moves())
        assert len(moves) == 6

    def test_parse_invalid_pgn(self):
        """Test that invalid PGN returns None."""
        game = parse_pgn("not a valid pgn")
        assert game is None or list(game.mainline_moves()) == []


class TestEvaluation:
    """Tests for evaluation functions."""

    def test_get_eval_cp_white(self):
        """Test eval extraction from white's perspective."""
        class MockScore:
            def white(self):
                return chess.engine.Cp(150)

        info = {"score": MockScore()}

        cp = get_eval_cp(info, chess.WHITE)
        assert cp == 150

        cp = get_eval_cp(info, chess.BLACK)
        assert cp == -150


class TestEngineAnalysis:
    """Tests requiring Stockfish - skipped if not available."""

    @pytest.fixture
    def engine(self):
        """Create engine instance."""
        try:
            engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
            yield engine
            engine.quit()
        except FileNotFoundError:
            pytest.skip(f"Stockfish not found at {STOCKFISH_PATH}")

    def test_analyze_starting_position(self, engine):
        """Test analyzing the starting position."""
        board = chess.Board()
        results = analyze_position(engine, board, time_limit=0.1, multipv=3)

        assert len(results) > 0
        assert "move_uci" in results[0]
        assert "eval_cp" in results[0]

    def test_analyze_tactical_position(self, engine):
        """Test analyzing a position with a clear best move."""
        board = chess.Board("r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4")
        results = analyze_position(engine, board, time_limit=0.2, multipv=3)

        assert len(results) > 0
        assert results[0]["move_uci"] == "h5f7"


class TestGameAnalysis:
    """Integration tests for full game analysis."""

    @pytest.fixture
    def engine(self):
        """Create engine instance."""
        try:
            engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
            yield engine
            engine.quit()
        except FileNotFoundError:
            pytest.skip(f"Stockfish not found at {STOCKFISH_PATH}")

    def test_analyze_game_with_blunder(self, engine):
        """Test analyzing a game containing an obvious blunder."""
        pgn = """[Event "Test"]
[White "testuser"]
[Black "opponent"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0"""

        game = parse_pgn(pgn)
        analyses, blunders = analyze_game(game, engine, "opponent", "test_game")

        assert len(analyses) > 0

        for b in blunders:
            print(f"Found blunder: {b.played_move_san}, should be {b.correct_move_san}")


class TestFullPipeline:
    """End-to-end pipeline tests."""

    def test_analyze_saved_games(self):
        """
        Analyze games from a saved file.

        Run test_get_user_games.py first to create the games file.
        """
        games_file = GAMES_DIR / "bloodxoxo_games.json"

        if not games_file.exists():
            pytest.skip(f"Games file not found: {games_file}. Run test_get_user_games.py first.")

        try:
            results = analyze_games_file(games_file, max_games=2)
        except FileNotFoundError:
            pytest.skip(f"Stockfish not found at {STOCKFISH_PATH}")

        assert results["games_analyzed"] <= 2
        assert len(results["saved_files"]) > 0


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        username = sys.argv[1]
    else:
        username = "bloodxoxo"

    games_file = GAMES_DIR / f"{username}_games.json"

    if not games_file.exists():
        print(f"Games file not found: {games_file}")
        print("Run test_get_user_games.py first to fetch games.")
        sys.exit(1)

    max_games = int(sys.argv[2]) if len(sys.argv) > 2 else 5

    print(f"Analyzing {max_games} games for {username}...")
    print(f"Blunder threshold: {BLUNDER_THRESHOLD_CP} centipawns")
    print(f"Stockfish path: {STOCKFISH_PATH}")
    print()

    results = analyze_games_file(games_file, max_games=max_games)

    print()
    print(f"Games analyzed: {results['games_analyzed']}")
    print(f"Moves analyzed: {results['total_moves_analyzed']}")
    print(f"Blunders found: {results['blunders_found']}")
    print(f"Files saved: {len(results['saved_files'])}")
