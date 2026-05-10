#!/bin/bash

SESSION="local_llm"

tmux kill-session -t $SESSION 2>/dev/null

tmux new-session -d -s $SESSION

# window 0 - ollama
tmux rename-window -t $SESSION:0 'ollama'

tmux send-keys -t $SESSION:0 '
cd ~/Work/local_llm &&
source venv/bin/activate &&
ollama serve
' C-m

# window 1 - api server
tmux new-window -t $SESSION -n 'api'

tmux send-keys -t $SESSION:1 '
cd ~/Work/local_llm &&
source venv/bin/activate &&
python3 main.py config.py
' C-m

tmux attach -t $SESSION
