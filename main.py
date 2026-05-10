##############################
#
# Standart Import
#
import argparse
from dataclasses import dataclass
import importlib.util
import sys
from AIHandler import AIHandler
from config import Config
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

    def initRoutes( self ):

        @self.app.post("/chat")
        def chat(req: ChatRequest):
            return aiHandler.requestToAI(req.message)

        @self.app.post("/clear")
        def clear():
            aiHandler.messageCaches.clear()
            return {"status": "cleared"}

    def run( self ):
        uvicorn.run( self.app, host=self.config.ServerHost, port=self.config.ServerPort )


##############################
#
# Functions
#

if __name__ == '__main__':
    parser = argparse.ArgumentParser( description = 'AI request server' )
    parser.add_argument( 'configFile', type=str, help='config file path' )
    args = parser.parse_args()

    config = loadConfig( args.configFile )

    aiHandler = AIHandler( config )
    server = ServerHandler( config, aiHandler )
    server.initRoutes()
    server.run()

