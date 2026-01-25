"""
Interactive blunder trainer GUI - practice fixing your chess mistakes.

Loads blunder puzzles from analyzed games and presents them in random order.
User must find the correct move to continue.
"""

import json
import random
import subprocess
import sys
import tkinter as tk
from tkinter import messagebox, simpledialog
from pathlib import Path

import chess

CONFIG_FILE = Path(__file__).parent / "config.json"
DATA_DIR = Path(__file__).parent / "data"
GAMES_DIR = DATA_DIR / "games"
ANALYZED_DIR = DATA_DIR / "analyzed_games"


def load_config() -> dict:
    """Load configuration from config file."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {}


def save_config(config: dict) -> None:
    """Save configuration to config file."""
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


def get_username_from_config() -> str | None:
    """Get username from config file."""
    config = load_config()
    return config.get("username")


def set_username_in_config(username: str) -> None:
    """Save username to config file."""
    config = load_config()
    config["username"] = username
    save_config(config)

SQUARE_SIZE = 64
BOARD_SIZE = SQUARE_SIZE * 8

LIGHT_SQUARE = "#F0D9B5"
DARK_SQUARE = "#B58863"
HIGHLIGHT_COLOR = "#7FFF7F"
SELECTED_COLOR = "#FFFF00"
WRONG_COLOR = "#FF6B6B"

# Use filled symbols for both - we'll color them differently
PIECE_UNICODE = {
    "K": "\u265A", "Q": "\u265B", "R": "\u265C", "B": "\u265D", "N": "\u265E", "P": "\u265F",
    "k": "\u265A", "q": "\u265B", "r": "\u265C", "b": "\u265D", "n": "\u265E", "p": "\u265F",
}

WHITE_PIECE_FILL = "#FFFFFF"
WHITE_PIECE_OUTLINE = "#000000"
BLACK_PIECE_FILL = "#000000"
BLACK_PIECE_OUTLINE = "#FFFFFF"


def get_user_stats(username: str) -> dict:
    """Get statistics for a user."""
    stats = {
        "username": username,
        "games_scraped": 0,
        "games_analyzed": 0,
        "total_blunders": 0,
    }

    # Count scraped games
    games_file = GAMES_DIR / f"{username}_games.json"
    if games_file.exists():
        with open(games_file) as f:
            data = json.load(f)
            stats["games_scraped"] = data.get("total_games", 0)

    # Count analyzed games and blunders
    user_dir = ANALYZED_DIR / username
    if user_dir.exists():
        for game_file in user_dir.glob("*.json"):
            stats["games_analyzed"] += 1
            with open(game_file) as f:
                data = json.load(f)
                stats["total_blunders"] += data.get("blunders_found", 0)

    return stats


def load_all_blunders(username: str) -> list[dict]:
    """Load all blunders for a user from analyzed game files."""
    user_dir = ANALYZED_DIR / username

    if not user_dir.exists():
        return []

    all_blunders = []

    for game_file in user_dir.glob("*.json"):
        with open(game_file) as f:
            data = json.load(f)

        for blunder in data.get("blunders", []):
            blunder["_game_url"] = data.get("game_url", "")
            blunder["_user_color"] = data.get("user_color", "white")
            all_blunders.append(blunder)

    return all_blunders


class HomePage(tk.Frame):
    """Home page showing user stats and actions."""

    def __init__(self, parent, username: str, on_start_practice, on_change_user):
        super().__init__(parent, padx=20, pady=20)
        self.username = username
        self.on_start_practice = on_start_practice
        self.on_change_user = on_change_user

        self.create_widgets()
        self.refresh_stats()

    def create_widgets(self):
        """Create home page UI."""
        # Title
        title = tk.Label(self, text="Blunder Trainer", font=("Arial", 24, "bold"))
        title.pack(pady=(0, 20))

        # Username section
        user_frame = tk.Frame(self)
        user_frame.pack(pady=10)

        tk.Label(user_frame, text="User:", font=("Arial", 12)).pack(side=tk.LEFT)
        self.username_label = tk.Label(user_frame, text=self.username, font=("Arial", 12, "bold"))
        self.username_label.pack(side=tk.LEFT, padx=5)
        tk.Button(user_frame, text="Change", command=self.on_change_user).pack(side=tk.LEFT, padx=5)

        # Stats frame
        stats_frame = tk.LabelFrame(self, text="Statistics", font=("Arial", 12), padx=20, pady=15)
        stats_frame.pack(pady=20, fill=tk.X)

        self.games_scraped_label = tk.Label(stats_frame, text="Games Scraped: 0", font=("Arial", 11))
        self.games_scraped_label.pack(anchor=tk.W, pady=2)

        self.games_analyzed_label = tk.Label(stats_frame, text="Games Analyzed: 0", font=("Arial", 11))
        self.games_analyzed_label.pack(anchor=tk.W, pady=2)

        self.blunders_label = tk.Label(stats_frame, text="Blunders Found: 0", font=("Arial", 11))
        self.blunders_label.pack(anchor=tk.W, pady=2)

        self.puzzles_label = tk.Label(stats_frame, text="Puzzles Available: 0", font=("Arial", 11), fg="green")
        self.puzzles_label.pack(anchor=tk.W, pady=2)

        # Action buttons
        button_frame = tk.Frame(self)
        button_frame.pack(pady=20)

        self.scrape_btn = tk.Button(
            button_frame,
            text="Scrape Games",
            command=self.scrape_games,
            width=15,
            height=2,
            font=("Arial", 11)
        )
        self.scrape_btn.pack(side=tk.LEFT, padx=10)

        self.analyze_btn = tk.Button(
            button_frame,
            text="Analyze Games",
            command=self.analyze_games,
            width=15,
            height=2,
            font=("Arial", 11)
        )
        self.analyze_btn.pack(side=tk.LEFT, padx=10)

        self.practice_btn = tk.Button(
            button_frame,
            text="Start Practicing",
            command=self.start_practice,
            width=15,
            height=2,
            font=("Arial", 11, "bold"),
            bg="#4CAF50",
            fg="white"
        )
        self.practice_btn.pack(side=tk.LEFT, padx=10)

        # Refresh button
        tk.Button(self, text="Refresh Stats", command=self.refresh_stats).pack(pady=10)

        # Status label
        self.status_label = tk.Label(self, text="", font=("Arial", 10), fg="gray")
        self.status_label.pack(pady=5)

    def refresh_stats(self):
        """Refresh statistics display."""
        stats = get_user_stats(self.username)

        self.username_label.config(text=self.username)
        self.games_scraped_label.config(text=f"Games Scraped: {stats['games_scraped']}")
        self.games_analyzed_label.config(text=f"Games Analyzed: {stats['games_analyzed']}")
        self.blunders_label.config(text=f"Blunders Found: {stats['total_blunders']}")
        self.puzzles_label.config(text=f"Puzzles Available: {stats['total_blunders']}")

        # Enable/disable buttons based on data availability
        if stats['total_blunders'] == 0:
            self.practice_btn.config(state=tk.DISABLED)
        else:
            self.practice_btn.config(state=tk.NORMAL)

    def set_username(self, username: str):
        """Update the username."""
        self.username = username
        self.refresh_stats()

    def scrape_games(self):
        """Open dialog to scrape games."""
        months = simpledialog.askinteger(
            "Scrape Games",
            f"How many months of games to scrape for {self.username}?",
            initialvalue=3,
            minvalue=1,
            maxvalue=24
        )
        if months:
            self.status_label.config(text=f"Scraping {months} months of games...")
            self.update()

            try:
                result = subprocess.run(
                    [sys.executable, "tests/test_get_user_games.py", self.username, str(months)],
                    cwd=Path(__file__).parent,
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    self.status_label.config(text="Scraping complete!", fg="green")
                else:
                    self.status_label.config(text=f"Error: {result.stderr[:100]}", fg="red")
            except Exception as e:
                self.status_label.config(text=f"Error: {e}", fg="red")

            self.refresh_stats()

    def analyze_games(self):
        """Open dialog to analyze games."""
        stats = get_user_stats(self.username)
        if stats["games_scraped"] == 0:
            messagebox.showwarning("No Games", "Please scrape games first.")
            return

        count = simpledialog.askinteger(
            "Analyze Games",
            f"How many games to analyze? (Have {stats['games_scraped']} scraped)",
            initialvalue=min(10, stats["games_scraped"]),
            minvalue=1,
            maxvalue=stats["games_scraped"]
        )
        if count:
            self.status_label.config(text=f"Analyzing {count} games (this may take a while)...")
            self.update()

            try:
                result = subprocess.run(
                    [sys.executable, "tests/test_engines.py", self.username, str(count)],
                    cwd=Path(__file__).parent,
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    self.status_label.config(text="Analysis complete!", fg="green")
                else:
                    self.status_label.config(text=f"Error: {result.stderr[:100]}", fg="red")
            except Exception as e:
                self.status_label.config(text=f"Error: {e}", fg="red")

            self.refresh_stats()

    def start_practice(self):
        """Start practice mode."""
        self.on_start_practice()


class ChessBoard(tk.Canvas):
    """Chess board widget with click-to-move interface."""

    def __init__(self, parent, flip=False):
        super().__init__(parent, width=BOARD_SIZE, height=BOARD_SIZE)
        self.flip = flip
        self.board = chess.Board()
        self.selected_square = None
        self.legal_moves = []
        self.on_move_callback = None
        self.wrong_squares = []

        self.bind("<Button-1>", self.on_click)
        self.draw_board()

    def set_position(self, fen: str, flip: bool = False):
        """Set the board position from FEN."""
        self.board = chess.Board(fen)
        self.flip = flip
        self.selected_square = None
        self.legal_moves = []
        self.wrong_squares = []
        self.draw_board()

    def draw_board(self):
        """Draw the chess board with pieces."""
        self.delete("all")

        for row in range(8):
            for col in range(8):
                display_row = 7 - row if not self.flip else row
                display_col = col if not self.flip else 7 - col

                x1 = display_col * SQUARE_SIZE
                y1 = display_row * SQUARE_SIZE
                x2 = x1 + SQUARE_SIZE
                y2 = y1 + SQUARE_SIZE

                square = chess.square(col, row)

                is_light = (row + col) % 2 == 1
                color = LIGHT_SQUARE if is_light else DARK_SQUARE

                if square in self.wrong_squares:
                    color = WRONG_COLOR
                elif square == self.selected_square:
                    color = SELECTED_COLOR
                elif any(m.to_square == square for m in self.legal_moves):
                    color = HIGHLIGHT_COLOR

                self.create_rectangle(x1, y1, x2, y2, fill=color, outline="")

                piece = self.board.piece_at(square)
                if piece:
                    symbol = PIECE_UNICODE.get(piece.symbol(), "")
                    cx = x1 + SQUARE_SIZE // 2
                    cy = y1 + SQUARE_SIZE // 2

                    if piece.color == chess.WHITE:
                        fill_color = WHITE_PIECE_FILL
                        outline_color = WHITE_PIECE_OUTLINE
                    else:
                        fill_color = BLACK_PIECE_FILL
                        outline_color = BLACK_PIECE_OUTLINE

                    # Draw outline by drawing text multiple times offset
                    for dx in [-2, -1, 0, 1, 2]:
                        for dy in [-2, -1, 0, 1, 2]:
                            if dx != 0 or dy != 0:
                                self.create_text(
                                    cx + dx, cy + dy,
                                    text=symbol,
                                    font=("Arial", 44, "bold"),
                                    fill=outline_color
                                )

                    # Draw main piece
                    self.create_text(
                        cx, cy,
                        text=symbol,
                        font=("Arial", 44, "bold"),
                        fill=fill_color
                    )

        self.draw_coordinates()

    def draw_coordinates(self):
        """Draw file and rank labels."""
        files = "abcdefgh" if not self.flip else "hgfedcba"
        ranks = "12345678" if self.flip else "87654321"

        for i, f in enumerate(files):
            x = i * SQUARE_SIZE + SQUARE_SIZE // 2
            self.create_text(x, BOARD_SIZE - 5, text=f, font=("Arial", 10), fill="black")

        for i, r in enumerate(ranks):
            y = i * SQUARE_SIZE + SQUARE_SIZE // 2
            self.create_text(8, y, text=r, font=("Arial", 10), fill="black")

    def coords_to_square(self, x: int, y: int) -> int:
        """Convert canvas coordinates to chess square."""
        col = x // SQUARE_SIZE
        row = 7 - (y // SQUARE_SIZE)

        if self.flip:
            col = 7 - col
            row = 7 - row

        return chess.square(col, row)

    def on_click(self, event):
        """Handle mouse click on board."""
        square = self.coords_to_square(event.x, event.y)
        self.wrong_squares = []

        if self.selected_square is None:
            piece = self.board.piece_at(square)
            if piece and piece.color == self.board.turn:
                self.selected_square = square
                self.legal_moves = [m for m in self.board.legal_moves if m.from_square == square]
        else:
            move = None
            for m in self.legal_moves:
                if m.to_square == square:
                    move = m
                    break

            if move:
                if self.on_move_callback:
                    self.on_move_callback(move)
            else:
                piece = self.board.piece_at(square)
                if piece and piece.color == self.board.turn:
                    self.selected_square = square
                    self.legal_moves = [m for m in self.board.legal_moves if m.from_square == square]
                else:
                    self.selected_square = None
                    self.legal_moves = []

        self.draw_board()

    def show_wrong(self, move: chess.Move):
        """Flash wrong move indicator."""
        self.wrong_squares = [move.from_square, move.to_square]
        self.draw_board()
        self.after(500, self.clear_wrong)

    def clear_wrong(self):
        """Clear wrong move indicator."""
        self.wrong_squares = []
        self.selected_square = None
        self.legal_moves = []
        self.draw_board()


class PracticePage(tk.Frame):
    """Practice page for solving puzzles."""

    def __init__(self, parent, username: str, on_back_home):
        super().__init__(parent, padx=10, pady=10)
        self.username = username
        self.on_back_home = on_back_home

        self.blunders = load_all_blunders(username)
        random.shuffle(self.blunders)
        self.current_index = 0
        self.solved = 0
        self.skipped = 0
        self.attempts = 0

        self.create_widgets()
        self.load_puzzle()

    def create_widgets(self):
        """Create the practice UI."""
        # Top bar with back button
        top_frame = tk.Frame(self)
        top_frame.pack(fill=tk.X, pady=(0, 10))

        tk.Button(top_frame, text="< Back to Home", command=self.on_back_home).pack(side=tk.LEFT)

        self.info_label = tk.Label(
            self,
            text="",
            font=("Arial", 12),
            justify=tk.LEFT
        )
        self.info_label.pack(pady=(0, 10))

        self.board = ChessBoard(self)
        self.board.pack()
        self.board.on_move_callback = self.on_move

        self.status_label = tk.Label(
            self,
            text="",
            font=("Arial", 14, "bold"),
            height=2
        )
        self.status_label.pack(pady=10)

        button_frame = tk.Frame(self)
        button_frame.pack(pady=5)

        tk.Button(button_frame, text="Skip", command=self.skip_puzzle, width=10).pack(side=tk.LEFT, padx=5)
        tk.Button(button_frame, text="Hint", command=self.show_hint, width=10).pack(side=tk.LEFT, padx=5)
        tk.Button(button_frame, text="Show Answer", command=self.show_answer, width=10).pack(side=tk.LEFT, padx=5)

        self.stats_label = tk.Label(
            self,
            text="",
            font=("Arial", 10),
            fg="gray"
        )
        self.stats_label.pack(pady=5)

    def load_puzzle(self):
        """Load the current puzzle."""
        if self.current_index >= len(self.blunders):
            self.show_results()
            return

        blunder = self.blunders[self.current_index]
        flip = blunder.get("_user_color") == "black"

        self.board.set_position(blunder["fen"], flip=flip)
        self.attempts = 0

        side = blunder.get("side_to_move", "white").capitalize()
        played = blunder.get("played_move_san", "?")
        drop = blunder.get("eval_drop_cp", 0)

        self.info_label.config(
            text=f"Puzzle {self.current_index + 1}/{len(self.blunders)}\n"
                 f"{side} to move - find the best move!\n"
                 f"You played: {played} (lost {drop}cp)"
        )

        self.status_label.config(text="", fg="black")
        self.update_stats()

    def on_move(self, move: chess.Move):
        """Handle user move."""
        blunder = self.blunders[self.current_index]

        if self.is_correct_move(move, blunder):
            self.status_label.config(text="Correct!", fg="green")
            self.solved += 1
            self.current_index += 1
            self.after(800, self.load_puzzle)
        else:
            self.attempts += 1
            self.status_label.config(text=f"X Wrong! Try again. (Attempts: {self.attempts})", fg="red")
            self.board.show_wrong(move)

    def is_correct_move(self, move: chess.Move, blunder: dict) -> bool:
        """Check if the move matches any acceptable solution."""
        move_uci = move.uci()

        if move_uci == blunder.get("correct_move_uci"):
            return True

        for acceptable in blunder.get("acceptable_moves", []):
            if move_uci == acceptable.get("move_uci"):
                return True

        return False

    def skip_puzzle(self):
        """Skip current puzzle."""
        blunder = self.blunders[self.current_index]
        answer = blunder.get("correct_move_san", "?")
        self.status_label.config(text=f"Skipped. Answer: {answer}", fg="orange")
        self.skipped += 1
        self.current_index += 1
        self.after(1200, self.load_puzzle)

    def show_hint(self):
        """Show a hint for the current puzzle."""
        blunder = self.blunders[self.current_index]
        correct = blunder.get("correct_move_san", "?")
        hint = f"Hint: Move the {correct[0] if correct else '?'}"
        self.status_label.config(text=hint, fg="blue")

    def show_answer(self):
        """Show the answer."""
        blunder = self.blunders[self.current_index]
        answer = blunder.get("correct_move_san", "?")
        self.status_label.config(text=f"Answer: {answer}", fg="purple")

    def update_stats(self):
        """Update statistics display."""
        total = self.current_index
        if total > 0:
            accuracy = self.solved / total * 100
        else:
            accuracy = 0
        self.stats_label.config(
            text=f"Solved: {self.solved} | Skipped: {self.skipped} | Accuracy: {accuracy:.0f}%"
        )

    def show_results(self):
        """Show final results."""
        total = len(self.blunders)
        accuracy = self.solved / total * 100 if total > 0 else 0

        messagebox.showinfo(
            "Training Complete",
            f"Solved: {self.solved}/{total}\n"
            f"Skipped: {self.skipped}\n"
            f"Accuracy: {accuracy:.1f}%"
        )
        self.on_back_home()


class BlunderTrainerApp(tk.Tk):
    """Main application with home page and practice page."""

    def __init__(self, username: str):
        super().__init__()
        self.username = username
        self.title("Blunder Trainer")
        self.resizable(False, False)

        self.current_page = None
        self.show_home_page()

    def show_home_page(self):
        """Show the home page."""
        if self.current_page:
            self.current_page.destroy()

        self.current_page = HomePage(
            self,
            self.username,
            on_start_practice=self.show_practice_page,
            on_change_user=self.change_user
        )
        self.current_page.pack()
        self.title(f"Blunder Trainer - {self.username}")

    def show_practice_page(self):
        """Show the practice page."""
        blunders = load_all_blunders(self.username)
        if not blunders:
            messagebox.showwarning("No Puzzles", "No puzzles available. Please analyze some games first.")
            return

        if self.current_page:
            self.current_page.destroy()

        self.current_page = PracticePage(
            self,
            self.username,
            on_back_home=self.show_home_page
        )
        self.current_page.pack()
        self.title(f"Blunder Trainer - Practice - {self.username}")

    def change_user(self):
        """Change the current user."""
        new_user = simpledialog.askstring(
            "Change User",
            "Enter Chess.com username:",
            initialvalue=self.username
        )
        if new_user and new_user.strip():
            self.username = new_user.strip()
            set_username_in_config(self.username)
            if isinstance(self.current_page, HomePage):
                self.current_page.set_username(self.username)
            self.title(f"Blunder Trainer - {self.username}")


def prompt_for_username() -> str | None:
    """Show a dialog to get the username before starting the app."""
    root = tk.Tk()
    root.withdraw()

    username = simpledialog.askstring(
        "Chess.com Username",
        "Enter your Chess.com username to get started:",
        parent=root
    )

    root.destroy()
    return username.strip() if username else None


if __name__ == "__main__":
    # Priority: command line arg > config file > prompt user
    if len(sys.argv) > 1:
        username = sys.argv[1]
        set_username_in_config(username)
    else:
        username = get_username_from_config()

    if not username:
        username = prompt_for_username()
        if not username:
            print("No username provided. Exiting.")
            sys.exit(1)
        set_username_in_config(username)

    app = BlunderTrainerApp(username)
    app.mainloop()
