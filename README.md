## Local LLM
This is for run local LLM using ollama on Mac.

### Setup
```
brew install ollama

# pull model for embeded
ollama pull nomic-embed-text
```

### Run by
```
./start_local_llm.sh
```
This will start ollama service and python fast api service to serve at localhost:8000
