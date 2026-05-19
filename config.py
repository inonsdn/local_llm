##############################
#
# Standart Import
#
import os

##############################
#
# Global Variable
#

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
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'formatter': 'standard',
                'filename': 'server.log',
                'maxBytes': 10 * 1024 * 1024,  # 10 MB
                'backupCount': 3,
                'encoding': 'utf-8',
            },
        },
        'loggers': {
            'AIHandler': {
                'level': 'DEBUG',
                'handlers': [ 'console', 'file' ],
                'propagate': False,
            },
            'main': {
                'level': 'DEBUG',
                'handlers': [ 'console', 'file' ],
                'propagate': False,
            },
            'helpers': {
                'level': 'DEBUG',
                'handlers': [ 'console', 'file' ],
                'propagate': False,
            },
        },
        'root': {
            'level': 'WARNING',
            'handlers': [ 'console' ],
        },
    }
class Config:

    Host = 'http://127.0.0.1'
    Port = 11434

    Model = 'qwen2.5-coder:7b'
    EmbeddedModel = 'nomic-embed-text'

    ChunkSize = 400
    ChunkOverlap = 50

    ServerHost = '0.0.0.0'
    ServerPort = 8000

    CacheFilePath = os.path.join( os.getcwd(), 'message.json' )
    VectorDBPath = os.path.join( os.getcwd(), 'chroma_db' )

    SupabaseUrl = os.environ.get( 'SUPABASE_URL', '' )
    SupabaseKey = os.environ.get( 'SUPABASE_SERVICE_ROLE_KEY', '' )

    InternalApiKey = os.environ.get( 'INTERNAL_API_KEY', '' )

