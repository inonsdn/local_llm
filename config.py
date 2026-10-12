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
            'ImageHandler': {
                'level': 'DEBUG',
                'handlers': [ 'console', 'file' ],
                'propagate': False,
            },
            'Interrogator': {
                'level': 'DEBUG',
                'handlers': [ 'console', 'file' ],
                'propagate': False,
            },
            'plugins': {
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

    ServerHost = os.environ.get( 'SERVER_HOST', '0.0.0.0' )
    ServerPort = int( os.environ.get( 'SERVER_PORT', '8000' ) )

    CacheFilePath = os.path.join( os.getcwd(), 'message.json' )
    VectorDBPath = os.path.join( os.getcwd(), 'chroma_db' )

    SupabaseUrl = os.environ.get( 'SUPABASE_URL', '' )
    SupabaseKey = os.environ.get( 'SUPABASE_SERVICE_ROLE_KEY', '' )

    InternalApiKey = os.environ.get( 'INTERNAL_API_KEY', 'ed31303e094f90418874841a0086732a995c08cecd5b8bf110b0e95a1dc2b1aa' )

    ComfyHost = os.environ.get( 'COMFY_HOST', 'http://127.0.0.1' )
    ComfyPort = int( os.environ.get( 'COMFY_PORT', '8188' ) )
    ImageModel = os.environ.get( 'IMAGE_MODEL', 'animagineXL31_v31.safetensors' )
    ImageWorkflowPath = os.path.join( os.getcwd(), 'workflows', 'sdxl_anime.json' )
    ImageIPAdapterWorkflowPath = os.path.join( os.getcwd(), 'workflows', 'sdxl_anime_ipadapter.json' )
    ImageImg2ImgWorkflowPath = os.path.join( os.getcwd(), 'workflows', 'sdxl_anime_img2img.json' )
    ImageOutputDir = os.path.join( os.getcwd(), 'generated' )
    CharactersDir = os.path.join( os.getcwd(), 'characters' )

    WD14ModelPath = os.path.join( os.getcwd(), 'models', 'wd14', 'wd-v1-4-moat-tagger-v2.onnx' )
    WD14TagsPath = os.path.join( os.getcwd(), 'models', 'wd14', 'selected_tags.csv' )
    WD14GeneralThreshold = 0.35
    WD14CharacterThreshold = 0.85
    ImageWidth = 1024
    ImageHeight = 1024
    ImageSteps = 8           # Hyper-SDXL 8-step CFG LoRA (was 28)
    ImageCfg = 5.0           # CFG-preserving distillation likes ~5 (was 7.0)
    ImageSampler = 'euler'   # Hyper-SD works best on euler (was euler_ancestral)
    ImageScheduler = 'normal'
    ImageDenoise = 0.5       # img2img only: 0.4=near-identical, 0.6=looser, 0.8=loosely inspired
    ImageNegativePrompt = 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry'

