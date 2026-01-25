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

interface ChessBoardProps {
  fen: string;
  expectedMove: string; // UCI format (e.g., "e2e4")
  onMoveResult: (correct: boolean, moveUci: string) => void;
  playerSide: "w" | "b";
  isActive: boolean;
  highlightSquare?: string | null;
}

export default function ChessBoard({
  fen,
  expectedMove,
  onMoveResult,
  playerSide,
  isActive,
  highlightSquare,
}: ChessBoardProps) {
  const [game, setGame] = useState(() => new Chess(fen));
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [boardWidth, setBoardWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const width = window.innerWidth;
      if (width >= 1024) {
        return Math.min(width * 0.4, 560);
      } else {
        return Math.min(width * 0.9, 500);
      }
    }
    return 400;
  });

  // Update board size on resize
  useEffect(() => {
    const updateBoardSize = () => {
      const width = window.innerWidth;
      if (width >= 1024) {
        setBoardWidth(Math.min(width * 0.4, 560));
      } else {
        setBoardWidth(Math.min(width * 0.9, 500));
      }
    };

    updateBoardSize();
    window.addEventListener("resize", updateBoardSize);
    return () => window.removeEventListener("resize", updateBoardSize);
  }, []);

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
    square,
  }: {
    piece: { pieceType: string } | null;
    square: string;
  }) => {
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

    // Highlight square (hint)
    if (highlightSquare) {
      styles[highlightSquare] = { backgroundColor: "rgba(244, 67, 54, 0.5)" };
    }

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
  }, [highlightSquare, selectedSquare, validMoves]);

  return (
    <div
      className="w-full"
      style={{ opacity: isActive ? 1 : 0.5 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="relative mx-auto"
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
            darkSquareStyle: { backgroundColor: "#5994EF" },
            lightSquareStyle: { backgroundColor: "#F2F6FA" },
            boardStyle: { width: boardWidth, height: boardWidth },
          }}
        />
      </div>
    </div>
  );
}
