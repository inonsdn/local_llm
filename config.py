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
