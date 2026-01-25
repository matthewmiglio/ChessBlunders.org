"""
Test the deployed Stockfish API on AWS.

Usage:
    python test_cloud_container.py <service-url>

Example:
    python test_cloud_container.py https://abc123.us-east-1.awsapprunner.com
"""

import argparse
import sys
import time

import requests


def test_health(base_url: str) -> bool:
    """Test health endpoint."""
    print("Testing /health...")
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"  OK: {data}")
            return True
        else:
            print(f"  FAIL: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"  FAIL: {e}")
        return False


def test_analyze(base_url: str) -> bool:
    """Test analyze endpoint."""
    print("Testing /analyze...")
    try:
        start = time.time()
        response = requests.post(
            f"{base_url}/analyze",
            json={
                "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                "time": 0.3,
                "multipv": 3
            },
            timeout=30
        )
        elapsed = time.time() - start

        if response.status_code == 200:
            data = response.json()
            moves = [m['move_san'] for m in data['best_moves']]
            print(f"  OK: Best moves = {moves} (took {elapsed:.2f}s)")
            return True
        else:
            print(f"  FAIL: Status {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"  FAIL: {e}")
        return False


def test_evaluate(base_url: str) -> bool:
    """Test evaluate endpoint."""
    print("Testing /evaluate...")
    try:
        start = time.time()
        response = requests.post(
            f"{base_url}/evaluate",
            json={
                "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                "move": "e2e4",
                "time": 0.3
            },
            timeout=30
        )
        elapsed = time.time() - start

        if response.status_code == 200:
            data = response.json()
            print(f"  OK: eval_drop={data['eval_drop_cp']}cp (took {elapsed:.2f}s)")
            return True
        else:
            print(f"  FAIL: Status {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"  FAIL: {e}")
        return False


def test_latency(base_url: str, iterations: int = 5) -> bool:
    """Test response latency."""
    print(f"Testing latency ({iterations} requests)...")
    try:
        times = []
        for i in range(iterations):
            start = time.time()
            response = requests.post(
                f"{base_url}/analyze",
                json={
                    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                    "time": 0.1,
                    "multipv": 1
                },
                timeout=30
            )
            elapsed = time.time() - start
            times.append(elapsed)
            print(f"  Request {i+1}: {elapsed:.2f}s")

        avg = sum(times) / len(times)
        print(f"  Average latency: {avg:.2f}s")
        return True
    except Exception as e:
        print(f"  FAIL: {e}")
        return False


def run_all_tests(base_url: str):
    """Run all tests against the cloud service."""
    print("=" * 60)
    print(f"Stockfish API Cloud Tests")
    print(f"URL: {base_url}")
    print("=" * 60)
    print()

    tests = [
        ("Health Check", lambda: test_health(base_url)),
        ("Analyze Position", lambda: test_analyze(base_url)),
        ("Evaluate Move", lambda: test_evaluate(base_url)),
        ("Latency Test", lambda: test_latency(base_url)),
    ]

    passed = 0
    failed = 0

    for name, test_func in tests:
        print(f"\n--- {name} ---")
        if test_func():
            passed += 1
        else:
            failed += 1

    print()
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return failed == 0


def main():
    parser = argparse.ArgumentParser(description="Test deployed Stockfish API")
    parser.add_argument("url", help="Service URL (e.g., https://abc123.awsapprunner.com)")
    args = parser.parse_args()

    # Normalize URL
    url = args.url.rstrip("/")
    if not url.startswith("http"):
        url = f"https://{url}"

    success = run_all_tests(url)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
