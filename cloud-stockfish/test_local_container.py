"""
Test the local Stockfish API container.

Usage:
    1. Build and run: docker-compose up --build
    2. Run tests: python test_local_container.py
"""

import requests
import sys

BASE_URL = "http://localhost:8000"


def test_health():
    """Test health endpoint."""
    print("Testing /health...")
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    print(f"  OK: {data}")


def test_analyze_starting_position():
    """Test analyzing the starting position."""
    print("Testing /analyze (starting position)...")
    response = requests.post(
        f"{BASE_URL}/analyze",
        json={
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "time": 0.2,
            "multipv": 3
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["side_to_move"] == "white"
    assert len(data["best_moves"]) > 0
    print(f"  OK: Best moves = {[m['move_san'] for m in data['best_moves']]}")


def test_analyze_tactical_position():
    """Test analyzing a position with a clear best move (Scholar's mate)."""
    print("Testing /analyze (tactical position)...")
    # Position where Qxf7# is mate
    response = requests.post(
        f"{BASE_URL}/analyze",
        json={
            "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
            "time": 0.3,
            "multipv": 1
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["best_moves"][0]["move_uci"] == "h5f7"
    assert data["best_moves"][0]["mate_in"] is not None
    print(f"  OK: Found mate - {data['best_moves'][0]}")


def test_evaluate_good_move():
    """Test evaluating a good opening move."""
    print("Testing /evaluate (good move e2e4)...")
    response = requests.post(
        f"{BASE_URL}/evaluate",
        json={
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "move": "e2e4",
            "time": 0.2
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_legal"] == True
    assert data["move_san"] == "e4"
    print(f"  OK: eval_before={data['eval_before_cp']}, eval_after={data['eval_after_cp']}, drop={data['eval_drop_cp']}")


def test_evaluate_blunder():
    """Test evaluating a blunder."""
    print("Testing /evaluate (blunder)...")
    # Position where Nf6 is a blunder (allows Qxf7#)
    response = requests.post(
        f"{BASE_URL}/evaluate",
        json={
            "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 4 4",
            "move": "g7g6",  # Blunder - should play Qe7 or similar
            "time": 0.3
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_legal"] == True
    # This should show a significant eval drop
    print(f"  OK: drop={data['eval_drop_cp']}cp, best was {data['best_move_san']}")


def test_evaluate_illegal_move():
    """Test evaluating an illegal move."""
    print("Testing /evaluate (illegal move)...")
    response = requests.post(
        f"{BASE_URL}/evaluate",
        json={
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "move": "e2e5",  # Illegal - pawn can't move 3 squares
            "time": 0.1
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_legal"] == False
    print(f"  OK: Correctly identified illegal move")


def test_invalid_fen():
    """Test with invalid FEN."""
    print("Testing /analyze (invalid FEN)...")
    response = requests.post(
        f"{BASE_URL}/analyze",
        json={
            "fen": "not a valid fen",
            "time": 0.1
        }
    )
    assert response.status_code == 400
    print(f"  OK: Correctly rejected invalid FEN")


def run_all_tests():
    """Run all tests."""
    print("=" * 50)
    print("Stockfish API Local Container Tests")
    print("=" * 50)
    print()

    tests = [
        test_health,
        test_analyze_starting_position,
        test_analyze_tactical_position,
        test_evaluate_good_move,
        test_evaluate_blunder,
        test_evaluate_illegal_move,
        test_invalid_fen,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except requests.exceptions.ConnectionError:
            print(f"  FAIL: Could not connect to {BASE_URL}")
            print("  Make sure the container is running: docker-compose up")
            sys.exit(1)
        except AssertionError as e:
            print(f"  FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"  FAIL: {e}")
            failed += 1
        print()

    print("=" * 50)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 50)

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
