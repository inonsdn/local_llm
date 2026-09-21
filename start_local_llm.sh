#!/bin/bash
#
# Start ollama with the model, then start the FastAPI service that talks to it.
#
set -euo pipefail

cd "$( dirname "$0" )"

MODEL="${OLLAMA_MODEL:-qwen2.5-coder:7b}"
OLLAMA_URL="${OLLAMA_HOST:-http://127.0.0.1}:${OLLAMA_PORT:-11434}"
VENV="${VENV:-venv}"

OLLAMA_PID=''

cleanup() {
    if [ -n "$OLLAMA_PID" ]; then
        echo "==> stopping ollama ( pid $OLLAMA_PID )"
        kill "$OLLAMA_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

command -v ollama >/dev/null || { echo "ollama is not installed"; exit 1; }

##############################
#
# ollama
#
if curl -sf "$OLLAMA_URL" >/dev/null 2>&1; then
    echo "==> ollama already running at $OLLAMA_URL"
else
    echo "==> starting ollama, logs -> ollama.log"
    ollama serve >ollama.log 2>&1 &
    OLLAMA_PID=$!

    for _ in $( seq 30 ); do
        curl -sf "$OLLAMA_URL" >/dev/null 2>&1 && break
        sleep 1
    done

    curl -sf "$OLLAMA_URL" >/dev/null 2>&1 || { echo "ollama did not start, see ollama.log"; exit 1; }
fi

if ollama list | awk '{ print $1 }' | grep -qx "$MODEL"; then
    echo "==> model $MODEL already pulled"
else
    echo "==> pulling model $MODEL"
    ollama pull "$MODEL"
fi

##############################
#
# api service
#
if [ ! -d "$VENV" ]; then
    echo "==> creating virtualenv $VENV"
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install -q -r requirements.txt
fi

echo "==> starting API on ${SERVER_HOST:-0.0.0.0}:${SERVER_PORT:-8000} with model $MODEL"
# not exec, so the trap above can stop ollama when the API stops
OLLAMA_MODEL="$MODEL" "$VENV/bin/python" main.py
