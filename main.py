##############################
#
# Standart Import
#
import argparse
from dataclasses import dataclass
import importlib.util
import sys
from AIHandler import AIHandler, OllamaRequestHandler
from config import Config
import json
import requests
from fastapi import FastAPI

from pydantic import BaseModel

import requests

import uvicorn

##############################
#
# Global Variable
#
##############################
#
# Helpers Funciton
#
def writeToJsonFile( filePath, jsonDicts ):
    with open( filePath, 'w' ) as f:
        f.write( json.dumps( jsonDicts ) )

def readFromJsonFile( filePath ):
    with open( filePath, 'r' ) as f:
        return json.loads( f.read() )

def loadConfig( configPath ):
    spec = importlib.util.spec_from_file_location( 'config', configPath )
    module = importlib.util.module_from_spec( spec )
    spec.loader.exec_module( module )
    return module.Config

##############################
#
# Class
#
class ChatRequest( BaseModel ):
    message: str

class ServerHandler:

    def __init__( self, config, aiHandler: AIHandler ):
        self.app = FastAPI()
        self.config = config
        self.aiHandler = aiHandler

    def initialize( self ):
        self.initRoutes()

    def initRoutes( self ):

        @self.app.post( '/chat' )
        def chat( req: ChatRequest ):
            res = self.aiHandler.sendMessage( req.message )
            return res

        @self.app.post( '/clear' )
        def clear():
            self.aiHandler.messageCaches.clear()
            return { 'status': 'cleared' }

    def run( self ):
        uvicorn.run( self.app, host=self.config.ServerHost, port=self.config.ServerPort )

    def cacheMessage( self ):
        jsonDicts = list( map( lambda m: m.asDict(), self.aiHandler.messageCaches ) )
        writeToJsonFile( self.config.CacheFilePath, jsonDicts )

##############################
#
# Functions
#

if __name__ == '__main__':
    parser = argparse.ArgumentParser( description = 'AI request server' )
    parser.add_argument( 'configFile', type=str, help='config file path' )
    args = parser.parse_args()

    config = loadConfig( args.configFile )

    handler = OllamaRequestHandler( config )
    aiHandler = AIHandler( config, handler )
    server = ServerHandler( config, aiHandler )
    server.initRoutes()
    try:
        server.run()
    except Exception:
        server.cacheMessage()
