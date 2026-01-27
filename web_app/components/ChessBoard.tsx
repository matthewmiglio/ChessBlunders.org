"use client";

import { useEffect, useState, useMemo } from "react";
import { Chess, Square, Move } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  handlePieceDropHelper,
  handleSquareClickHelper,
  moveToUci,
  movesMatch,
} from "@/lib/chessBoardHelpers";

// Board color themes
export const BOARD_THEMES = [
  { name: "Classic Blue", dark: "#5994EF", light: "#F2F6FA" },
  { name: "Traditional Brown", dark: "#B58863", light: "#F0D9B5" },
  { name: "Forest Green", dark: "#769656", light: "#EEEED2" },
  { name: "Ocean Blue", dark: "#4A90A4", light: "#FFFFFF" },
  { name: "Purple Haze", dark: "#9F7AEA", light: "#E9D5FF" },
  { name: "Sunset Orange", dark: "#F97316", light: "#FED7AA" },
  { name: "Bubblegum Pink", dark: "#EC4899", light: "#FCE7F3" },
  { name: "Neon Cyber", dark: "#10B981", light: "#1F2937" },
  { name: "Lava Red", dark: "#DC2626", light: "#FEE2E2" },
  { name: "Cosmic Purple", dark: "#7C3AED", light: "#1E1B4B" },
] as const;

interface ChessBoardProps {
  fen: string;
  expectedMove: string; // UCI format (e.g., "e2e4")
  onMoveResult: (correct: boolean, moveUci: string) => void;
  playerSide: "w" | "b";
  isActive: boolean;
  hintArrow?: { from: string; to: string } | null;
  onPieceClick?: () => void;
  darkSquareColor?: string;
  lightSquareColor?: string;
  size?: number; // Optional explicit board size
}

export default function ChessBoard({
  fen,
  expectedMove,
  onMoveResult,
  playerSide,
  isActive,
  hintArrow,
  onPieceClick,
  darkSquareColor = "#5994EF",
  lightSquareColor = "#F2F6FA",
  size,
}: ChessBoardProps) {
  const [game, setGame] = useState(() => new Chess(fen));
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [boardWidth, setBoardWidth] = useState(() => {
    if (size) return size;
    if (typeof window !== "undefined") {
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (width >= 1024) {
        // Use viewport height minus padding for stats bar and margins
        const availableHeight = height - 80;
        return Math.min(availableHeight, 820);
      } else {
        return Math.min(width * 0.95, 600);
      }
    }
    return 500;
  });

  // Update board size on resize (or when size prop changes)
  useEffect(() => {
    if (size) {
      setBoardWidth(size);
      return;
    }
    const updateBoardSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (width >= 1024) {
        // Use viewport height minus padding for stats bar and margins
        const availableHeight = height - 80;
        setBoardWidth(Math.min(availableHeight, 820));
      } else {
        setBoardWidth(Math.min(width * 0.95, 600));
      }
    };

    updateBoardSize();
    window.addEventListener("resize", updateBoardSize);
    return () => window.removeEventListener("resize", updateBoardSize);
  }, [size]);

  // Sync game state with FEN prop
  useEffect(() => {
    const newGame = new Chess();
    try {
      newGame.load(fen);
      setGame(newGame);
    } catch {
      console.warn("Invalid FEN:", fen);
    }
    // Reset selection when FEN changes
    setSelectedSquare(null);
    setValidMoves([]);
  }, [fen]);

  const handleMove = (sourceSquare: Square, targetSquare: Square) => {
    const result = handlePieceDropHelper({
      sourceSquare,
      targetSquare,
      game,
      isActive,
    });

    if (!result.valid || !result.move) {
      return false;
    }

    const userMoveUci = moveToUci(result.move);
    const isCorrect = movesMatch(userMoveUci, expectedMove);

    // Update game state for visual feedback
    if (result.newGame) {
      setGame(result.newGame);
    }

    // Notify parent of result
    onMoveResult(isCorrect, userMoveUci);

    return true;
  };

  const handlePieceDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    piece: { isSparePiece: boolean; position: string; pieceType: string };
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean => {
    if (!targetSquare) return false;
    return handleMove(sourceSquare as Square, targetSquare as Square);
  };

  const handleSquareClick = ({
    piece,
    square,
  }: {
    piece: { pieceType: string } | null;
    square: string;
  }) => {
    // Notify parent when a piece is clicked (to hide hint arrow)
    if (piece && onPieceClick) {
      onPieceClick();
    }

    const result = handleSquareClickHelper({
      square: square as Square,
      game,
      selectedSquare,
      validMoves,
      isActive,
    });

    switch (result.action) {
      case "select":
        setSelectedSquare(result.newSelectedSquare!);
        setValidMoves(result.newValidMoves!);
        break;
      case "deselect":
        setSelectedSquare(null);
        setValidMoves([]);
        break;
      case "move":
        setSelectedSquare(null);
        setValidMoves([]);
        if (result.moveResult?.valid && result.moveResult.move) {
          const userMoveUci = moveToUci(result.moveResult.move);
          const isCorrect = movesMatch(userMoveUci, expectedMove);

          if (result.moveResult.newGame) {
            setGame(result.moveResult.newGame);
          }

          onMoveResult(isCorrect, userMoveUci);
        }
        break;
    }
  };

  // Custom square styles for selection and valid moves
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "rgba(56, 189, 248, 0.6)",
      };
    }

    // Valid move indicators
    validMoves.forEach((move) => {
      if (move.to !== selectedSquare) {
        const isCapture =
          move.captured !== undefined ||
          move.flags.includes("c") ||
          move.flags.includes("e");

        if (isCapture) {
          styles[move.to] = {
            boxShadow: "inset 0 0 0 4px rgba(128, 128, 128, 0.7)",
            borderRadius: "8px",
          };
        } else {
          styles[move.to] = {
            background: `
              radial-gradient(circle at center,
                rgba(128, 128, 128, 0.5) 0%,
                rgba(128, 128, 128, 0.5) 20%,
                transparent 22%)
            `,
          };
        }
      }
    });

    return styles;
  }, [selectedSquare, validMoves]);

  // Arrow for hint
  const arrows = useMemo(() => {
    if (hintArrow) {
      return [{
        startSquare: hintArrow.from,
        endSquare: hintArrow.to,
        color: "rgba(255, 111, 0, 0.8)"
      }];
    }
    return [];
  }, [hintArrow]);

  return (
    <div
      style={{ opacity: isActive ? 1 : 0.5 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="relative"
        style={{ width: boardWidth, height: boardWidth }}
      >
        <Chessboard
          options={{
            position: game.fen(),
            onPieceDrop: handlePieceDrop,
            onSquareClick: handleSquareClick,
            animationDurationInMs: 200,
            boardOrientation: playerSide === "w" ? "white" : "black",
            allowDragging: isActive,
            squareStyles: squareStyles,
            darkSquareStyle: { backgroundColor: darkSquareColor },
            lightSquareStyle: { backgroundColor: lightSquareColor },
            boardStyle: { width: boardWidth, height: boardWidth },
            arrows: arrows,
          }}
        />
      </div>
    </div>
  );
}
