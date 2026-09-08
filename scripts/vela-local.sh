#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VELA_DIR="${ROOT_DIR}/.vela-starterkit"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker with Compose v2 is required" >&2
  exit 1
fi

if [ ! -d "${VELA_DIR}/.git" ]; then
  git clone https://github.com/HorizenOfficial/vela-starterkit.git "${VELA_DIR}"
else
  git -C "${VELA_DIR}" pull --ff-only
fi

cd "${VELA_DIR}/dockerfiles"
if [ ! -f .env ]; then
  cp .env.dev .env
fi

echo "Starting the official Horizen VELA local development stack..."
docker compose up
