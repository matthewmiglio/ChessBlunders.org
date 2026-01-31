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

interface TopMoveArrow {
  from: string;
  to: string;
  rank: number; // 1, 2, or 3
}

interface ChessBoardProps {
  fen: string;
  expectedMove: string; // UCI format (e.g., "e2e4")
  onMoveResult: (correct: boolean, moveUci: string) => void;
  playerSide: "w" | "b";
  isActive: boolean;
  hintArrow?: { from: string; to: string } | null;
  blunderArrow?: { from: string; to: string } | null; // Arrow showing the blunder move with X
  topMoveArrows?: TopMoveArrow[] | null; // Arrows showing top 3 moves after puzzle solved
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
  blunderArrow,
  topMoveArrows,
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
      // Invalid FEN - ignore
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

  // Arrows for hint only (blunder uses custom line)
  const arrows = useMemo(() => {
    const result = [];
    if (hintArrow) {
      result.push({
        startSquare: hintArrow.from,
        endSquare: hintArrow.to,
        color: "rgba(255, 111, 0, 0.8)" // Orange for hint
      });
    }
    return result;
  }, [hintArrow]);

  // Calculate line coordinates for blunder (line with X at end)
  const blunderLineCoords = useMemo(() => {
    if (!blunderArrow) return null;

    // Convert square notation to coordinates (0-7)
    const fileToNum = (file: string) => file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankToNum = (rank: string) => parseInt(rank) - 1;

    const fromFile = fileToNum(blunderArrow.from[0]);
    const fromRank = rankToNum(blunderArrow.from[1]);
    const toFile = fileToNum(blunderArrow.to[0]);
    const toRank = rankToNum(blunderArrow.to[1]);

    // Check if this is a knight move (L-shape: 2+1 or 1+2)
    const fileDiff = Math.abs(toFile - fromFile);
    const rankDiff = Math.abs(toRank - fromRank);
    const isKnightMove = (fileDiff === 2 && rankDiff === 1) || (fileDiff === 1 && rankDiff === 2);

    // Convert to percentage based on board orientation
    const squareSize = 100 / 8;
    let x1, y1, x2, y2, xMid, yMid;
    if (playerSide === "w") {
      x1 = (fromFile + 0.5) * squareSize;
      y1 = (7 - fromRank + 0.5) * squareSize;
      x2 = (toFile + 0.5) * squareSize;
      y2 = (7 - toRank + 0.5) * squareSize;
      // For knight moves, the midpoint goes in the direction of the longer move first
      if (isKnightMove) {
        if (fileDiff === 2) {
          xMid = x2;
          yMid = y1;
        } else {
          xMid = x1;
          yMid = y2;
        }
      }
    } else {
      x1 = (7 - fromFile + 0.5) * squareSize;
      y1 = (fromRank + 0.5) * squareSize;
      x2 = (7 - toFile + 0.5) * squareSize;
      y2 = (toRank + 0.5) * squareSize;
      if (isKnightMove) {
        if (fileDiff === 2) {
          xMid = x2;
          yMid = y1;
        } else {
          xMid = x1;
          yMid = y2;
        }
      }
    }

    return { x1, y1, x2, y2, xMid, yMid, isKnightMove };
  }, [blunderArrow, playerSide]);

  // Calculate line coordinates for top move arrows
  const topMoveLineCoords = useMemo(() => {
    if (!topMoveArrows || topMoveArrows.length === 0) return [];

    const fileToNum = (file: string) => file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankToNum = (rank: string) => parseInt(rank) - 1;
    const squareSize = 100 / 8;

    return topMoveArrows.map((arrow) => {
      const fromFile = fileToNum(arrow.from[0]);
      const fromRank = rankToNum(arrow.from[1]);
      const toFile = fileToNum(arrow.to[0]);
      const toRank = rankToNum(arrow.to[1]);

      // Check if this is a knight move (L-shape: 2+1 or 1+2)
      const fileDiff = Math.abs(toFile - fromFile);
      const rankDiff = Math.abs(toRank - fromRank);
      const isKnightMove = (fileDiff === 2 && rankDiff === 1) || (fileDiff === 1 && rankDiff === 2);

      let x1, y1, x2, y2, xMid, yMid;
      if (playerSide === "w") {
        x1 = (fromFile + 0.5) * squareSize;
        y1 = (7 - fromRank + 0.5) * squareSize;
        x2 = (toFile + 0.5) * squareSize;
        y2 = (7 - toRank + 0.5) * squareSize;
        // For knight moves, the midpoint goes in the direction of the longer move first
        if (isKnightMove) {
          if (fileDiff === 2) {
            // Move horizontally first (2 squares), then vertically (1 square)
            xMid = x2;
            yMid = y1;
          } else {
            // Move vertically first (2 squares), then horizontally (1 square)
            xMid = x1;
            yMid = y2;
          }
        }
      } else {
        x1 = (7 - fromFile + 0.5) * squareSize;
        y1 = (fromRank + 0.5) * squareSize;
        x2 = (7 - toFile + 0.5) * squareSize;
        y2 = (toRank + 0.5) * squareSize;
        // For knight moves on black side
        if (isKnightMove) {
          if (fileDiff === 2) {
            xMid = x2;
            yMid = y1;
          } else {
            xMid = x1;
            yMid = y2;
          }
        }
      }

      // Get color based on rank
      let color;
      switch (arrow.rank) {
        case 1:
          color = "rgba(24, 190, 93, 0.9)"; // Green
          break;
        case 2:
          color = "rgba(59, 130, 246, 0.9)"; // Blue
          break;
        case 3:
          color = "rgba(234, 179, 8, 0.9)"; // Yellow
          break;
        default:
          color = "rgba(128, 128, 128, 0.9)";
      }

      return { x1, y1, x2, y2, xMid, yMid, isKnightMove, rank: arrow.rank, color };
    });
  }, [topMoveArrows, playerSide]);

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
        {/* Line with X at end for blunder */}
        {blunderLineCoords && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={boardWidth}
            height={boardWidth}
            viewBox="0 0 100 100"
          >
            {/* L-shaped polyline for knight moves, straight line for others */}
            {blunderLineCoords.isKnightMove && blunderLineCoords.xMid !== undefined && blunderLineCoords.yMid !== undefined ? (
              <polyline
                points={`${blunderLineCoords.x1},${blunderLineCoords.y1} ${blunderLineCoords.xMid},${blunderLineCoords.yMid} ${blunderLineCoords.x2},${blunderLineCoords.y2}`}
                fill="none"
                stroke="rgba(220, 38, 38, 0.8)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <line
                x1={blunderLineCoords.x1}
                y1={blunderLineCoords.y1}
                x2={blunderLineCoords.x2}
                y2={blunderLineCoords.y2}
                stroke="rgba(220, 38, 38, 0.8)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
            {/* Small X at destination */}
            <g
              transform={`translate(${blunderLineCoords.x2}, ${blunderLineCoords.y2})`}
            >
              {/* Dark red outline for visibility */}
              <line
                x1="-1.25"
                y1="-1.25"
                x2="1.25"
                y2="1.25"
                stroke="#7f1d1d"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="1.25"
                y1="-1.25"
                x2="-1.25"
                y2="1.25"
                stroke="#7f1d1d"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* Red X */}
              <line
                x1="-1.25"
                y1="-1.25"
                x2="1.25"
                y2="1.25"
                stroke="rgba(220, 38, 38, 0.8)"
                strokeWidth="1"
                strokeLinecap="round"
              />
              <line
                x1="1.25"
                y1="-1.25"
                x2="-1.25"
                y2="1.25"
                stroke="rgba(220, 38, 38, 0.8)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </g>
          </svg>
        )}
        {/* Arrows for top moves after puzzle solved */}
        {topMoveLineCoords.length > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={boardWidth}
            height={boardWidth}
            viewBox="0 0 100 100"
          >
            <defs>
              {/* Arrowhead markers for each color */}
              <marker
                id="arrowhead-green"
                markerWidth="4"
                markerHeight="4"
                refX="3"
                refY="2"
                orient="auto"
              >
                <polygon points="0 0, 4 2, 0 4" fill="rgba(24, 190, 93, 0.9)" />
              </marker>
              <marker
                id="arrowhead-blue"
                markerWidth="4"
                markerHeight="4"
                refX="3"
                refY="2"
                orient="auto"
              >
                <polygon points="0 0, 4 2, 0 4" fill="rgba(59, 130, 246, 0.9)" />
              </marker>
              <marker
                id="arrowhead-yellow"
                markerWidth="4"
                markerHeight="4"
                refX="3"
                refY="2"
                orient="auto"
              >
                <polygon points="0 0, 4 2, 0 4" fill="rgba(234, 179, 8, 0.9)" />
              </marker>
            </defs>
            {topMoveLineCoords.map((coord, idx) => {
              const markerId = coord.rank === 1 ? "arrowhead-green" : coord.rank === 2 ? "arrowhead-blue" : "arrowhead-yellow";

              // Calculate angle for label positioning (use first segment for knight moves)
              const angle = coord.isKnightMove && coord.xMid !== undefined && coord.yMid !== undefined
                ? Math.atan2(coord.yMid - coord.y1, coord.xMid - coord.x1)
                : Math.atan2(coord.y2 - coord.y1, coord.x2 - coord.x1);
              const labelDistance = 5; // Distance from start of line
              const labelX = coord.x1 + Math.cos(angle) * labelDistance;
              const labelY = coord.y1 + Math.sin(angle) * labelDistance;

              return (
                <g key={idx}>
                  {/* L-shaped polyline for knight moves, straight line for others */}
                  {coord.isKnightMove && coord.xMid !== undefined && coord.yMid !== undefined ? (
                    <polyline
                      points={`${coord.x1},${coord.y1} ${coord.xMid},${coord.yMid} ${coord.x2},${coord.y2}`}
                      fill="none"
                      stroke={coord.color}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      markerEnd={`url(#${markerId})`}
                    />
                  ) : (
                    <line
                      x1={coord.x1}
                      y1={coord.y1}
                      x2={coord.x2}
                      y2={coord.y2}
                      stroke={coord.color}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      markerEnd={`url(#${markerId})`}
                    />
                  )}
                  {/* Label background circle */}
                  <circle
                    cx={labelX}
                    cy={labelY}
                    r="2.5"
                    fill="rgba(32, 32, 32, 0.9)"
                    stroke={coord.color}
                    strokeWidth="0.5"
                  />
                  {/* Label text */}
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={coord.color}
                    fontSize="2.5"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    {coord.rank}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
