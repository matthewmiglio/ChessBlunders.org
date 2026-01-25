# Cloud Stockfish Service

Containerize Stockfish as a REST API for AWS deployment.

## Overview

A Docker container that:
- Accepts a chess position (FEN) and a move
- Returns the engine evaluation/score
- Used to analyze games and find blunders

## Implementation Plan

### 1. Local Container Setup
**Location:** `D:\my_files\my_programs\ChessBlunders.org\cloud-stockfish\`

- Create Dockerfile with Stockfish
- Create REST API (FastAPI) that wraps Stockfish UCI
- Endpoints:
  - `POST /analyze` - analyze position, return best moves + evals
  - `POST /evaluate` - evaluate a specific move
  - `GET /health` - health check

### 2. Local Testing
**File:** `test_local_container.py`

- Test the container locally via Docker
- Verify endpoints work correctly

### 3. AWS Deployment Guide
**File:** `deploy.md`

- Instructions for deploying to AWS (ECS/App Runner)
- Container registry setup (ECR)
- Networking/security config

### 4. Cloud Testing
**File:** `test_cloud_container.py`

- Test the deployed AWS container
- Verify remote endpoints

## Tech Stack

- **Container:** Docker
- **API:** FastAPI (Python)
- **Engine:** Stockfish binary
- **Cloud:** AWS (ECS or App Runner)

## Quick Start

```bash
# Build and run locally
docker-compose up --build

# Test endpoints
python test_local_container.py
```
