##############################
#
# Standart Import
#
import logging
import logging.config

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from AIHandler import AIHandler
from config import Config, LoggingConfig

##############################
#
# Global Variable
#
logger = logging.getLogger( __name__ )

##############################
#
# Class
#
class ChatRequest( BaseModel ):
    message: str = ''
    room_id: str = 'default'

class ServerHandler:

    def __init__( self, config: Config, aiHandler: AIHandler ):
        self.app = FastAPI( title='Local LLM' )
        self.config = config
        self.aiHandler = aiHandler
        self.initRoutes()

    def initRoutes( self ):

        @self.app.get( '/health' )
        def health():
            return { 'status': 'ok', 'model': self.config.Model }

        @self.app.post( '/chat' )
        def chat( req: ChatRequest ):
            if not req.message.strip():
                raise HTTPException( status_code=422, detail='message is required' )
            try:
                content = self.aiHandler.sendMessage( req.message, req.room_id )
            except Exception as e:
                logger.error( 'chat failed for room=%s: %s', req.room_id, e )
                raise HTTPException( status_code=502, detail='AI server error' )
            return { 'content': content }

        @self.app.post( '/clear' )
        def clear( req: ChatRequest ):
            self.aiHandler.clear( req.room_id )
            return { 'status': 'cleared' }

    def run( self ):
        uvicorn.run( self.app, host=self.config.ServerHost, port=self.config.ServerPort )

##############################
#
# Functions
#
if __name__ == '__main__':
    logging.config.dictConfig( LoggingConfig.ConfigDict )

    config = Config
    logger.info( 'starting server on %s:%s, model=%s', config.ServerHost, config.ServerPort, config.Model )

    ServerHandler( config, AIHandler( config ) ).run()
