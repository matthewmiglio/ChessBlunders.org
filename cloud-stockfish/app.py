"""
Stockfish REST API - Analyze chess positions via HTTP.
"""

import subprocess
from contextlib import asynccontextmanager
from typing import Optional

import chess
import chess.engine
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

STOCKFISH_PATH = "/usr/local/bin/stockfish"
ENGINE: Optional[chess.engine.SimpleEngine] = None


class AnalyzeRequest(BaseModel):
    fen: str = Field(..., description="FEN string of the position")
    depth: Optional[int] = Field(None, description="Search depth (mutually exclusive with time)")
    time: Optional[float] = Field(0.3, description="Analysis time in seconds")
    multipv: int = Field(3, description="Number of principal variations to return")


class EvaluateRequest(BaseModel):
    fen: str = Field(..., description="FEN string of the position before the move")
    move: str = Field(..., description="Move in UCI format (e.g., e2e4)")
    time: Optional[float] = Field(0.3, description="Analysis time in seconds")


class MoveInfo(BaseModel):
    move_uci: str
    move_san: str
    eval_cp: Optional[int] = None
    mate_in: Optional[int] = None


class AnalyzeResponse(BaseModel):
    fen: str
    side_to_move: str
    best_moves: list[MoveInfo]


class EvaluateResponse(BaseModel):
    fen: str
    move_uci: str
    move_san: str
    is_legal: bool
    eval_before_cp: Optional[int] = None
    eval_after_cp: Optional[int] = None
    eval_drop_cp: Optional[int] = None
    best_move_uci: Optional[str] = None
    best_move_san: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ENGINE
    ENGINE = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    ENGINE.configure({"Threads": 2, "Hash": 128})
    yield
    if ENGINE:
        ENGINE.quit()


app = FastAPI(
    title="Stockfish API",
    description="REST API for chess position analysis using Stockfish",
    version="1.0.0",
    lifespan=lifespan
)


def get_eval_cp(score: chess.engine.PovScore, turn: chess.Color) -> tuple[Optional[int], Optional[int]]:
    """Extract centipawn eval and mate score from engine score."""
    pov_score = score.white()

    if pov_score.is_mate():
        mate_in = pov_score.mate()
        return None, mate_in
    else:
        cp = pov_score.score()
        if turn == chess.BLACK:
            cp = -cp
        return cp, None


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "engine": "stockfish"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_position(request: AnalyzeRequest):
    """
    Analyze a chess position and return the best moves.
    """
    if ENGINE is None:
        raise HTTPException(status_code=503, detail="Engine not initialized")

    try:
        board = chess.Board(request.fen)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid FEN: {e}")

    if request.depth:
        limit = chess.engine.Limit(depth=request.depth)
    else:
        limit = chess.engine.Limit(time=request.time or 0.3)

    try:
        analysis = ENGINE.analyse(board, limit, multipv=request.multipv)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

    best_moves = []
    for info in analysis:
        if "pv" not in info or not info["pv"]:
            continue

        move = info["pv"][0]
        score = info.get("score")

        eval_cp, mate_in = None, None
        if score:
            eval_cp, mate_in = get_eval_cp(score, board.turn)

        best_moves.append(MoveInfo(
            move_uci=move.uci(),
            move_san=board.san(move),
            eval_cp=eval_cp,
            mate_in=mate_in
        ))

    return AnalyzeResponse(
        fen=request.fen,
        side_to_move="white" if board.turn == chess.WHITE else "black",
        best_moves=best_moves
    )


@app.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_move(request: EvaluateRequest):
    """
    Evaluate a specific move in a position.
    Returns the eval before, eval after, and the drop.
    """
    if ENGINE is None:
        raise HTTPException(status_code=503, detail="Engine not initialized")

    try:
        board = chess.Board(request.fen)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid FEN: {e}")

    try:
        move = chess.Move.from_uci(request.move)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid move format: {e}")

    if move not in board.legal_moves:
        return EvaluateResponse(
            fen=request.fen,
            move_uci=request.move,
            move_san=request.move,
            is_legal=False
        )

    move_san = board.san(move)
    limit = chess.engine.Limit(time=request.time or 0.3)

    # Analyze position before move
    try:
        before_analysis = ENGINE.analyse(board, limit, multipv=1)
        before_score = before_analysis[0].get("score") if before_analysis else None
        best_move = before_analysis[0]["pv"][0] if before_analysis and "pv" in before_analysis[0] else None

        eval_before_cp, _ = get_eval_cp(before_score, board.turn) if before_score else (None, None)
        best_move_uci = best_move.uci() if best_move else None
        best_move_san = board.san(best_move) if best_move else None
    except Exception:
        eval_before_cp = None
        best_move_uci = None
        best_move_san = None

    # Make the move and analyze after
    board.push(move)

    try:
        after_analysis = ENGINE.analyse(board, limit, multipv=1)
        after_score = after_analysis[0].get("score") if after_analysis else None
        eval_after_cp, _ = get_eval_cp(after_score, board.turn) if after_score else (None, None)

        # Negate because it's from opponent's perspective now
        if eval_after_cp is not None:
            eval_after_cp = -eval_after_cp
    except Exception:
        eval_after_cp = None

    # Calculate drop
    eval_drop_cp = None
    if eval_before_cp is not None and eval_after_cp is not None:
        eval_drop_cp = eval_before_cp - eval_after_cp

    return EvaluateResponse(
        fen=request.fen,
        move_uci=request.move,
        move_san=move_san,
        is_legal=True,
        eval_before_cp=eval_before_cp,
        eval_after_cp=eval_after_cp,
        eval_drop_cp=eval_drop_cp,
        best_move_uci=best_move_uci,
        best_move_san=best_move_san
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
