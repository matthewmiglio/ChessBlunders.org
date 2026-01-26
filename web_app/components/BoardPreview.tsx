"use client";

import { Chessboard } from "react-chessboard";

interface BoardPreviewProps {
  fen: string;
  size?: number;
}

export function BoardPreview({ fen, size = 120 }: BoardPreviewProps) {
  return (
    <div style={{ width: size, height: size }} className="rounded overflow-hidden border border-white/10">
      <Chessboard
        options={{
          position: fen,
          allowDragging: false,
          showNotation: false,
          boardStyle: { width: size, height: size },
          darkSquareStyle: { backgroundColor: "#5994EF" },
          lightSquareStyle: { backgroundColor: "#F2F6FA" },
        }}
      />
    </div>
  );
}
