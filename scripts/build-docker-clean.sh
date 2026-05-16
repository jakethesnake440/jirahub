#!/usr/bin/env bash
set -euo pipefail

echo "Building JIRA Hub with plain progress output..."
docker compose build --progress=plain --no-cache jirahub

echo "Starting containers..."
docker compose up -d

echo "Current containers:"
docker compose ps
