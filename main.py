##############################
#
# Standart Import
#
import argparse
from dataclasses import dataclass
import importlib.util
import logging
import logging.config
import sys
from uuid import UUID
from AIHandler import AIHandler, OllamaRequestHandler
from config import Config
import json
import requests
from fastapi import FastAPI, Header, HTTPException, Depends

from pydantic import BaseModel


import uvicorn

##############################
#
# Global Variable
#
logger = logging.getLogger( __name__ )

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
    user_id: str | None = None
    room_id: str | None = None

class ServerHandler:

    def __init__( self, config, aiHandler: AIHandler ):
        self.app = FastAPI()
        self.config = config
        self.aiHandler = aiHandler

    def initialize( self ):
        self.initRoutes()

    def initRoutes( self ):

        apiKey = self.config.InternalApiKey

        def verifyApiKey( x_api_key: str = Header( default='' ) ):
            if apiKey and x_api_key != apiKey:
                logger.warning( 'Rejected request with invalid API key' )
                raise HTTPException( status_code=401, detail='Invalid API key' )

        def parseUUID( value: str | None, field: str ) -> str:
            if not value:
                logger.warning( 'Missing required field: %s', field )
                raise HTTPException( status_code=422, detail=f'{field} is required' )
            try:
                return UUID( value ).bytes.hex()
            except ( ValueError, AttributeError ):
                logger.warning( 'Invalid UUID for field %s: %r', field, value )
                raise HTTPException( status_code=422, detail=f'Invalid {field}' )

        @self.app.post( '/chat' )
        def chat( req: ChatRequest, _: None = Depends( verifyApiKey ) ):
            userId = parseUUID( req.user_id, 'user_id' )
            roomId = parseUUID( req.room_id, 'room_id' )
            logger.info( 'chat request user=%s room=%s', userId, roomId )
            res = self.aiHandler.sendMessage( req.message, userId=userId, roomId=roomId )
            logger.debug( 'chat response user=%s room=%s', userId, roomId )
            return res

        @self.app.post( '/clear' )
        def clear( req: ChatRequest, _: None = Depends( verifyApiKey ) ):
            userId = parseUUID( req.user_id, 'user_id' )
            roomId = parseUUID( req.room_id, 'room_id' )
            logger.info( 'clear cache user=%s room=%s', userId, roomId )
            self.aiHandler.messageCaches.clear( userId=userId, roomId=roomId )
            return { 'status': 'cleared' }

    def run( self ):
        uvicorn.run( self.app, host=self.config.ServerHost, port=self.config.ServerPort )

    def cacheMessage( self ):
        jsonDicts = []
        for roomToMsgs in self.aiHandler.messageCaches.caches.values():
            for msgs in roomToMsgs.values():
                jsonDicts.extend( m.asDict() for m in msgs )
        writeToJsonFile( self.config.CacheFilePath, jsonDicts )
        logger.info( 'cache saved: %d messages -> %s', len( jsonDicts ), self.config.CacheFilePath )

##############################
#
# Functions
#

if __name__ == '__main__':
    parser = argparse.ArgumentParser( description = 'AI request server' )
    parser.add_argument( 'configFile', type=str, help='config file path' )
    args = parser.parse_args()

    config = loadConfig( args.configFile )

    from config import LoggingConfig
    logging.config.dictConfig( LoggingConfig.ConfigDict )

    logger.info( 'Starting server on %s:%s', config.ServerHost, config.ServerPort )
    logger.info( 'Supabase enabled: %s', bool( config.SupabaseUrl ) )

    handler = OllamaRequestHandler( config )
    aiHandler = AIHandler( config, handler )
    server = ServerHandler( config, aiHandler )
    server.initRoutes()

    try:
        server.run()
    finally:
        logger.info( 'Shutting down, saving cache...' )
        server.cacheMessage()
