"""
AWS Lambda handler for Stockfish chess analysis.
"""

import json
import subprocess

STOCKFISH_PATH = "/usr/local/bin/stockfish"


def analyze_position(fen: str, depth: int = 20, multipv: int = 1, debug: bool = False) -> dict:
    """Analyze a chess position with Stockfish."""
    import select
    import time

    process = subprocess.Popen(
        [STOCKFISH_PATH],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1
    )

    # Send UCI init commands
    process.stdin.write("uci\n")
    process.stdin.write("isready\n")
    process.stdin.flush()

    # Wait for readyok
    while True:
        line = process.stdout.readline()
        if "readyok" in line:
            break

    # Set MultiPV
    process.stdin.write(f"setoption name MultiPV value {multipv}\n")
    process.stdin.write("isready\n")
    process.stdin.flush()

    # Wait for readyok
    while True:
        line = process.stdout.readline()
        if "readyok" in line:
            break

    # Start analysis
    process.stdin.write(f"position fen {fen}\n")
    process.stdin.write(f"go depth {depth}\n")
    process.stdin.flush()

    # Collect output until bestmove
    output_lines = []
    start_time = time.time()
    while time.time() - start_time < 25:  # Timeout safety
        line = process.stdout.readline()
        if line:
            output_lines.append(line)
            if line.startswith("bestmove"):
                break

    # Clean up
    process.stdin.write("quit\n")
    process.stdin.flush()
    process.wait(timeout=2)

    output = "".join(output_lines)
    result = parse_stockfish_output(output)

    if debug:
        result["_debug_raw_output"] = output
        result["_debug_line_count"] = len(output_lines)

    return result


def parse_stockfish_output(output: str) -> dict:
    """Parse Stockfish output to extract analysis."""
    lines_raw = output.strip().split("\n")
    result = {"lines": []}
    bestmove = None

    for line in lines_raw:
        # Look for bestmove
        if line.startswith("bestmove"):
            parts = line.split()
            if len(parts) >= 2:
                bestmove = parts[1]
            continue

        # Look for info lines with depth, score, and pv
        if not line.startswith("info"):
            continue

        # Skip lines without pv (like currmove lines)
        if " pv " not in line:
            continue

        # Skip upperbound/lowerbound lines
        if "upperbound" in line or "lowerbound" in line:
            continue

        parts = line.split()

        try:
            # Find key indices
            if "depth" not in parts or "score" not in parts or "pv" not in parts:
                continue

            depth_idx = parts.index("depth") + 1
            score_idx = parts.index("score") + 1
            pv_idx = parts.index("pv") + 1

            depth_val = int(parts[depth_idx])
            score_type = parts[score_idx]
            score_value = int(parts[score_idx + 1])
            pv = parts[pv_idx:]

            # Get multipv if present
            pv_num = 1
            if "multipv" in parts:
                multipv_idx = parts.index("multipv") + 1
                pv_num = int(parts[multipv_idx])

            if score_type == "mate":
                score = {"mate": score_value}
            else:
                score = {"cp": score_value}

            line_data = {
                "depth": depth_val,
                "score": score,
                "pv": pv,
                "multipv": pv_num
            }

            # Keep only the deepest line for each multipv
            existing = next(
                (item for item in result["lines"] if item["multipv"] == pv_num),
                None
            )
            if existing:
                if depth_val > existing["depth"]:
                    result["lines"].remove(existing)
                    result["lines"].append(line_data)
            else:
                result["lines"].append(line_data)

        except (ValueError, IndexError):
            continue

    # Sort by multipv number
    result["lines"].sort(key=lambda x: x["multipv"])

    # Set bestmove
    if bestmove:
        result["bestmove"] = bestmove
    elif result["lines"]:
        result["bestmove"] = result["lines"][0]["pv"][0]

    return result


def handler(event, context):
    """Lambda handler function."""
    try:
        # Handle API Gateway proxy integration
        if "body" in event:
            body = json.loads(event["body"]) if isinstance(event["body"], str) else event["body"]
        else:
            body = event

        fen = body.get("fen")
        if not fen:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "FEN position required"})
            }

        depth = body.get("depth", 20)
        multipv = body.get("multipv", 1)
        debug = body.get("debug", False)

        # Limit depth/multipv to prevent timeout
        depth = min(depth, 25)
        multipv = min(multipv, 5)

        result = analyze_position(fen, depth, multipv, debug)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps(result)
        }

    except subprocess.TimeoutExpired:
        return {
            "statusCode": 504,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Analysis timeout"})
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)})
        }
