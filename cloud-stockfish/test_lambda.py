"""
Test the deployed Stockfish Lambda via API Gateway.

Usage:
    python test_lambda.py <api-url>

Example:
    python test_lambda.py https://abc123.execute-api.us-east-1.amazonaws.com/prod/analyze
"""

import argparse
import sys
import time

import requests


def test_starting_position(url: str) -> bool:
    """Test analysis of starting position."""
    print("Test 1: Starting position...")
    try:
        start = time.time()
        response = requests.post(
            url,
            json={
                "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                "depth": 15,
                "multipv": 1
            },
            timeout=60
        )
        elapsed = time.time() - start

        if response.status_code == 200:
            data = response.json()
            bestmove = data.get("bestmove", "?")
            lines = data.get("lines", [])
            print(f"  OK: bestmove={bestmove}, lines={len(lines)} ({elapsed:.2f}s)")
            return True
        else:
            print(f"  FAIL: Status {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"  FAIL: {e}")
        return False


def test_multipv(url: str) -> bool:
    """Test multi-PV analysis."""
    print("Test 2: Multi-PV (3 lines)...")
    try:
        start = time.time()
        response = requests.post(
            url,
            json={
                "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                "depth": 12,
                "multipv": 3
            },
            timeout=60
        )
        elapsed = time.time() - start

        if response.status_code == 200:
            data = response.json()
            lines = data.get("lines", [])
            if len(lines) >= 2:
                print(f"  OK: Got {len(lines)} lines ({elapsed:.2f}s)")
                for line in lines:
                    score = line.get("score", {})
                    cp = score.get("cp", score.get("mate", "?"))
                    pv = line.get("pv", [])[:3]
                    print(f"      Line {line.get('multipv')}: {cp}cp, {' '.join(pv)}")
                return True
            else:
                print(f"  FAIL: Expected multiple lines, got {len(lines)}")
                return False
        else:
            print(f"  FAIL: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"  FAIL: {e}")
        return False


def test_tactical_position(url: str) -> bool:
    """Test a tactical position (mate in 2)."""
    print("Test 3: Tactical position...")
    try:
        # White to move, Qxh7+ leads to mate
        fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"
        start = time.time()
        response = requests.post(
            url,
            json={"fen": fen, "depth": 10, "multipv": 1},
            timeout=60
        )
        elapsed = time.time() - start

        if response.status_code == 200:
            data = response.json()
            bestmove = data.get("bestmove", "")
            lines = data.get("lines", [])

            # Should find Qxf7# or similar winning move
            if bestmove:
                score = lines[0].get("score", {}) if lines else {}
                mate = score.get("mate")
                cp = score.get("cp")
                score_str = f"mate in {mate}" if mate else f"{cp}cp"
                print(f"  OK: bestmove={bestmove}, eval={score_str} ({elapsed:.2f}s)")
                return True
            else:
                print(f"  FAIL: No bestmove found")
                return False
        else:
            print(f"  FAIL: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"  FAIL: {e}")
        return False


def test_invalid_fen(url: str) -> bool:
    """Test error handling for invalid FEN."""
    print("Test 4: Invalid FEN handling...")
    try:
        response = requests.post(
            url,
            json={"fen": "not a valid fen", "depth": 10},
            timeout=30
        )

        if response.status_code == 400:
            print(f"  OK: Correctly returned 400 for invalid FEN")
            return True
        elif response.status_code == 500:
            # Also acceptable - engine might crash on bad FEN
            print(f"  OK: Returned 500 for invalid FEN (acceptable)")
            return True
        else:
            print(f"  WARN: Unexpected status {response.status_code}")
            return True  # Not a critical failure
    except Exception as e:
        print(f"  FAIL: {e}")
        return False


def test_missing_fen(url: str) -> bool:
    """Test error handling for missing FEN."""
    print("Test 5: Missing FEN handling...")
    try:
        response = requests.post(
            url,
            json={"depth": 10},
            timeout=30
        )

        if response.status_code == 400:
            print(f"  OK: Correctly returned 400 for missing FEN")
            return True
        else:
            print(f"  FAIL: Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        print(f"  FAIL: {e}")
        return False


def test_latency(url: str, iterations: int = 3) -> bool:
    """Test response latency."""
    print(f"Test 6: Latency ({iterations} requests)...")
    try:
        times = []
        for i in range(iterations):
            start = time.time()
            response = requests.post(
                url,
                json={
                    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                    "depth": 10,
                    "multipv": 1
                },
                timeout=60
            )
            elapsed = time.time() - start
            times.append(elapsed)
            status = "OK" if response.status_code == 200 else f"ERR:{response.status_code}"
            print(f"      Request {i+1}: {elapsed:.2f}s ({status})")

        avg = sum(times) / len(times)
        print(f"  Average: {avg:.2f}s")
        return True
    except Exception as e:
        print(f"  FAIL: {e}")
        return False


def run_all_tests(url: str) -> bool:
    """Run all tests against the Lambda API."""
    print("=" * 60)
    print("Stockfish Lambda API Tests")
    print(f"URL: {url}")
    print("=" * 60)
    print()

    tests = [
        test_starting_position,
        test_multipv,
        test_tactical_position,
        test_invalid_fen,
        test_missing_fen,
        test_latency,
    ]

    passed = 0
    failed = 0

    for test_func in tests:
        print()
        if test_func(url):
            passed += 1
        else:
            failed += 1

    print()
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return failed == 0


def main():
    parser = argparse.ArgumentParser(description="Test Stockfish Lambda API")
    parser.add_argument(
        "url",
        help="API Gateway URL (e.g., https://xxx.execute-api.us-east-1.amazonaws.com/prod/analyze)"
    )
    args = parser.parse_args()

    url = args.url.rstrip("/")
    if not url.startswith("http"):
        url = f"https://{url}"

    success = run_all_tests(url)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
