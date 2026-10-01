// Chess.com usernames: letters, digits, _ and -. Checked before the name goes into a Chess.com URL.
export const CHESS_USERNAME_RE = /^[A-Za-z0-9_-]{3,25}$/;

export async function chessUsernameExists(username: string): Promise<boolean> {
  if (!CHESS_USERNAME_RE.test(username)) return false;
  const res = await fetch(`https://api.chess.com/pub/player/${username}`, {
    headers: { "User-Agent": "ChessBlunders.org/1.0" },
  });
  return res.ok;
}
