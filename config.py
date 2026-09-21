##############################
#
# Standart Import
#
import os

##############################
#
# Class
#
class LoggingConfig:

    ConfigDict = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'standard': {
                'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
                'datefmt': '%Y-%m-%d %H:%M:%S',
            },
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'formatter': 'standard',
                'stream': 'ext://sys.stdout',
            },
        },
        'root': {
            'level': 'INFO',
            'handlers': [ 'console' ],
        },
    }

class Config:

    # ollama service
    Host = os.environ.get( 'OLLAMA_HOST', 'http://127.0.0.1' )
    Port = int( os.environ.get( 'OLLAMA_PORT', '11434' ) )
    Model = os.environ.get( 'OLLAMA_MODEL', 'qwen2.5-coder:7b' )

    # this fastapi service
    ServerHost = os.environ.get( 'SERVER_HOST', '0.0.0.0' )
    ServerPort = int( os.environ.get( 'SERVER_PORT', '8000' ) )

    # how many messages of a room are replayed back to the model
    HistoryLimit = int( os.environ.get( 'HISTORY_LIMIT', '20' ) )
