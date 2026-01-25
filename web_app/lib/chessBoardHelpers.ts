"use client";

import { Chess, Square, Move } from "chess.js";

export function getValidMovesForSquare(game: Chess, square: Square): Move[] {
  try {
    return game.moves({ square, verbose: true });
  } catch {
    return [];
  }
}

export function isSquareOccupiedByCurrentPlayer(game: Chess, square: Square): boolean {
  const piece = game.get(square);
  return piece !== null && piece !== undefined && piece.color === game.turn();
}

export function handlePieceDropHelper({
  sourceSquare,
  targetSquare,
  game,
  isActive,
}: {
  sourceSquare: Square;
  targetSquare: Square;
  game: Chess;
  isActive: boolean;
}): {
  valid: boolean;
  move: Move | null;
  newGame: Chess | null;
} {
  if (!isActive) {
    return { valid: false, move: null, newGame: null };
  }

  const newGame = new Chess(game.fen());
  try {
    const move = newGame.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q", // Always promote to queen for simplicity
    });
    return { valid: true, move, newGame };
  } catch {
    return { valid: false, move: null, newGame: null };
  }
}

export function handleSquareClickHelper({
  square,
  game,
  selectedSquare,
  validMoves,
  isActive,
}: {
  square: Square;
  game: Chess;
  selectedSquare: Square | null;
  validMoves: Move[];
  isActive: boolean;
}): {
  action: "select" | "deselect" | "move" | "none";
  newSelectedSquare?: Square | null;
  newValidMoves?: Move[];
  moveResult?: {
    valid: boolean;
    move: Move | null;
    newGame: Chess | null;
  };
} {
  if (!isActive) {
    return { action: "none" };
  }

  // If no square is currently selected
  if (!selectedSquare) {
    // Check if clicked square has a piece belonging to current player
    if (isSquareOccupiedByCurrentPlayer(game, square)) {
      const moves = getValidMovesForSquare(game, square);
      return {
        action: "select",
        newSelectedSquare: square,
        newValidMoves: moves,
      };
    }
    return { action: "none" };
  }

  // If clicking the same square, deselect
  if (selectedSquare === square) {
    return {
      action: "deselect",
      newSelectedSquare: null,
      newValidMoves: [],
    };
  }

  // Check if clicked square is a valid move destination
  const targetMove = validMoves.find((move) => move.to === square);
  if (targetMove) {
    const moveResult = handlePieceDropHelper({
      sourceSquare: selectedSquare,
      targetSquare: square,
      game,
      isActive,
    });

    return {
      action: "move",
      newSelectedSquare: null,
      newValidMoves: [],
      moveResult,
    };
  }

  // If clicking another piece of the same color, switch selection
  if (isSquareOccupiedByCurrentPlayer(game, square)) {
    const moves = getValidMovesForSquare(game, square);
    return {
      action: "select",
      newSelectedSquare: square,
      newValidMoves: moves,
    };
  }

  // Otherwise, deselect
  return {
    action: "deselect",
    newSelectedSquare: null,
    newValidMoves: [],
  };
}

// Convert a move to UCI format (e2e4)
export function moveToUci(move: Move): string {
  return move.from + move.to + (move.promotion || "");
}

// Check if a UCI move matches the expected move (handles promotions)
export function movesMatch(userMoveUci: string, expectedMoveUci: string): boolean {
  // Normalize: lowercase and compare first 4 chars (source + target)
  const userBase = userMoveUci.toLowerCase().slice(0, 4);
  const expectedBase = expectedMoveUci.toLowerCase().slice(0, 4);
  return userBase === expectedBase;
}
