"""
Test fetching games from Chess.com API and saving to data/games/
"""

import json
from pathlib import Path

import pytest
import requests

DATA_DIR = Path(__file__).parent.parent / "data"
GAMES_DIR = DATA_DIR / "games"

CHESSCOM_API_BASE = "https://api.chess.com/pub/player"
REQUEST_HEADERS = {
    "User-Agent": "ChessBlunderTrainer/1.0 (contact: <your-email>)"
}


def get_archives(username: str) -> list[str]:
    """Get list of monthly archive URLs for a user."""
    url = f"{CHESSCOM_API_BASE}/{username}/games/archives"
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
    response.raise_for_status()
    return response.json().get("archives", [])


def get_games_for_month(archive_url: str) -> list[dict]:
    """Fetch all games for a specific month archive."""
    response = requests.get(archive_url, headers=REQUEST_HEADERS, timeout=60)
    response.raise_for_status()
    return response.json().get("games", [])


def fetch_all_games(username: str, max_months: int | None = None) -> list[dict]:
    """
    Fetch all games for a user from Chess.com.

    Args:
        username: Chess.com username
        max_months: Limit number of months to fetch (None = all)

    Returns:
        List of game dictionaries with PGN and metadata
    """
    archives = get_archives(username)

    if max_months:
        archives = archives[-max_months:]

    all_games = []
    for archive_url in archives:
        games = get_games_for_month(archive_url)
        all_games.extend(games)
        print(f"Fetched {len(games)} games from {archive_url}")

    return all_games


def save_games(username: str, games: list[dict]) -> Path:
    """
    Save games to JSON file in data/games/.

    Returns path to saved file.
    """
    GAMES_DIR.mkdir(parents=True, exist_ok=True)

    output_file = GAMES_DIR / f"{username}_games.json"

    save_data = {
        "username": username,
        "total_games": len(games),
        "games": games
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(save_data, f, indent=2)

    print(f"Saved {len(games)} games to {output_file}")
    return output_file


def filter_standard_chess_games(games: list[dict]) -> list[dict]:
    """Filter to only standard chess games (no variants)."""
    return [
        g for g in games
        if g.get("rules") == "chess" and g.get("pgn")
    ]


class TestChessComAPI:
    """Tests for Chess.com API integration."""

    def test_get_archives_valid_user(self):
        """Test fetching archives for a known user."""
        archives = get_archives("hikaru")
        assert len(archives) > 0
        assert all("games" in url for url in archives)

    def test_get_archives_invalid_user(self):
        """Test that invalid username raises error."""
        with pytest.raises(requests.HTTPError):
            get_archives("this_user_definitely_does_not_exist_12345")

    def test_get_games_for_month(self):
        """Test fetching games from a specific archive."""
        archives = get_archives("hikaru")
        if archives:
            games = get_games_for_month(archives[-1])
            assert isinstance(games, list)

    def test_filter_standard_games(self):
        """Test filtering out variants."""
        test_games = [
            {"rules": "chess", "pgn": "1. e4 e5"},
            {"rules": "chess960", "pgn": "1. e4 e5"},
            {"rules": "chess", "pgn": None},
            {"rules": "chess", "pgn": "1. d4 d5"},
        ]
        filtered = filter_standard_chess_games(test_games)
        assert len(filtered) == 2


class TestFetchAndSave:
    """Integration tests for fetching and saving games."""

    @pytest.fixture
    def cleanup_test_files(self):
        """Clean up test files after test."""
        yield
        test_file = GAMES_DIR / "test_user_games.json"
        if test_file.exists():
            test_file.unlink()

    def test_fetch_and_save_games(self):
        """
        Fetch games for a real user and save them.

        Change TEST_USERNAME to your Chess.com username.
        """
        TEST_USERNAME = "hikaru"
        MAX_MONTHS = 1

        games = fetch_all_games(TEST_USERNAME, max_months=MAX_MONTHS)
        assert len(games) > 0, f"No games found for {TEST_USERNAME}"

        standard_games = filter_standard_chess_games(games)
        print(f"Found {len(standard_games)} standard chess games out of {len(games)} total")

        output_path = save_games(TEST_USERNAME, standard_games)
        assert output_path.exists()

        with open(output_path) as f:
            saved = json.load(f)
        assert saved["username"] == TEST_USERNAME
        assert saved["total_games"] == len(standard_games)


if __name__ == "__main__":
    import sys

    username = sys.argv[1] if len(sys.argv) > 1 else "hikaru"
    max_months = int(sys.argv[2]) if len(sys.argv) > 2 else 1

    print(f"Fetching games for {username} (last {max_months} months)...")
    games = fetch_all_games(username, max_months=max_months)
    standard_games = filter_standard_chess_games(games)
    print(f"Found {len(standard_games)} standard chess games")

    save_games(username, standard_games)
