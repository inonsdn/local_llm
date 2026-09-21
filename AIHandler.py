##############################
#
# Standart Import
#
import logging

import requests

from config import Config

##############################
#
# Global Variable
#
logger = logging.getLogger( __name__ )

##############################
#
# Class
#
class AIHandler:
    ''' connect to the LLM model served by ollama

        keeps a short in memory history per room so the model can follow
        the conversation, nothing is persisted
    '''

    def __init__( self, config: Config ):
        self.model = config.Model
        self.chatUrl = f'{config.Host}:{config.Port}/api/chat'
        self.historyLimit = config.HistoryLimit
        self.histories: dict[ str, list[ dict ] ] = dict()

    def getHistory( self, roomId: str ) -> list[ dict ]:
        return self.histories.setdefault( roomId, [] )

    def clear( self, roomId: str ):
        count = len( self.histories.pop( roomId, [] ) )
        logger.info( 'cleared %d messages for room=%s', count, roomId )

    def sendMessage( self, message: str, roomId: str ) -> str:
        ''' send the message plus the room history to the model and
            return the answer content
        '''
        history = self.getHistory( roomId )
        messages = history[ -self.historyLimit: ] + [ { 'role': 'user', 'content': message } ]

        logger.info( 'asking %s for room=%s', self.model, roomId )
        res = requests.post( self.chatUrl, json={
            'model': self.model,
            'messages': messages,
            'stream': False,
        })
        res.raise_for_status()
        resData = res.json()

        if 'error' in resData:
            logger.error( 'ollama error: %s', resData['error'] )
            raise ValueError( resData['error'] )

        content = resData['message']['content']

        history.append( { 'role': 'user', 'content': message } )
        history.append( { 'role': 'assistant', 'content': content } )

        return content
