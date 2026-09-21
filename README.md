## Local LLM

Minimal local chat stack:

- `AIHandler.py` — class that connects to the LLM model served by ollama
- `main.py` — FastAPI service exposing `/chat`, `/clear`, `/health`
- `config.py` — settings (model, ports), all overridable by env vars
- `client/` — Next.js frontend, a single chat page

### Setup
```
brew install ollama          # or https://ollama.com/download
```

### Run the model + API
```
./start_local_llm.sh
```
The script starts `ollama serve`, pulls the model if needed, creates `venv/`
on first run, and starts the FastAPI service on http://localhost:8000.

Override defaults with env vars:
```
OLLAMA_MODEL=llama3.2 SERVER_PORT=8001 ./start_local_llm.sh
```

### Run the chat frontend
```
cd client
npm install
npm run dev                  # http://localhost:3000
```
The frontend proxies to the API through `/api/chat`; point it elsewhere with
`AI_URL=http://127.0.0.1:8000`.

### API
```
curl -X POST http://localhost:8000/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "hello", "room_id": "default"}'
```
