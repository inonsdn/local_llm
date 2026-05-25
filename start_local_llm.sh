#!/bin/bash

SESSION="local_llm"

tmux kill-session -t $SESSION 2>/dev/null

tmux new-session -d -s $SESSION

# window 0 - ollama
tmux rename-window -t $SESSION:0 'ollama'

tmux send-keys -t $SESSION:0 '
ollama serve
' C-m

# window 1 - api server
tmux new-window -t $SESSION -n 'api'

tmux send-keys -t $SESSION:1 '
cd ~/Work/local_llm &&
export PYTHONPATH=venv3.12/lib/python3.12/site-packages
source venv3.12/bin/activate &&
python3 main.py config.py
' C-m


# window 2 - cloudfare tunnle
tmux new-window -t $SESSION -n 'cloudfare'

tmux send-keys -t $SESSION:2 '
cloudflared tunnel --url http://localhost:8000
' C-m

tmux attach -t $SESSION
