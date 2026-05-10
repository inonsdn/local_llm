##############################
#
# Standart Import
#
import argparse
from dataclasses import dataclass
import importlib.util
import sys
from config import Config
import requests

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
@dataclass
class Message:
    role: str
    content: str

    def asDict( self ):
        return {
            'role': self.role,
            'content': self.content
        }

class AIHandler:

    def __init__( self, config: Config ):
        self.host = config.Host
        self.port = config.Port
        self.model = config.Model
        self.messageCaches: list[ Message ] = list()

    @property
    def chatUrl( self ):
        return f'{self.host}:{self.port}/api/chat'

    def getRequestPacket( self, message: Message ):
        messages = list( map( lambda m: m.asDict(), self.messageCaches ) )
        messages.append( message.asDict() )
        return {
            'model': self.model,
            'messages': messages,
            'stream': False,
        }

    def requestToAI( self, message: str ):
        msgObj = Message( 'user', message )
        res = requests.post( self.chatUrl, json=self.getRequestPacket( msgObj ) )
        responseData = res.json()

        if 'error' in responseData:
            return print(responseData['error'])

        self.messageCaches.append( msgObj )
        self.messageCaches.append( Message( **responseData['message'] ) )

        print(responseData)

        return responseData['message']

##############################
#
# Functions
#

if __name__ == '__main__':
    parser = argparse.ArgumentParser( description = 'AI request server' )
    parser.add_argument( 'configFile', type=str, help='config file path' )
    args = parser.parse_args()

    config = loadConfig( args.configFile )

    reqHandler = AIHandler( config )
    reqHandler.requestToAI('Hello')
