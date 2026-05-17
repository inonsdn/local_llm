##############################
#
# Standart Import
#
import argparse
import hashlib
import chromadb
from dataclasses import dataclass
import importlib.util
import sys
from config import Config
from helpers import loadConfig, readFromJsonFile, writeToJsonFile
import requests

##############################
#
# Global Variable
#
ChunkSize = 400
ChunkOverlap = 50

##############################
#
# Helpers Funciton
#

# simplified version of what chromadb does internally
def cosine_similarity( vec_a, vec_b ):
    ''' simplified version of what chromadb does internally
        result: 1.0 = identical, 0.0 = unrelated, -1.0 = opposite
    '''
    dot = sum( a * b for a, b in zip( vec_a, vec_b ) )
    mag_a = sum( a ** 2 for a in vec_a ) ** 0.5
    mag_b = sum( b ** 2 for b in vec_b ) ** 0.5
    return dot / ( mag_a * mag_b )

# result: 1.0 = identical, 0.0 = unrelated, -1.0 = opposite

def getChunkId(userId: str, source: str, content: str) -> str:
    contentHash = hashlib.md5(content.encode()).hexdigest()[:8]
    return f'{userId}_{source}_{contentHash}'

##############################
#
# Class
#
class Message:

    def __init__( self, role: str, content: str, userId: str, roomId: str ):
        self.role = role
        self.content = content
        self.userId = userId
        self.roomId = roomId

        self.embededContext = None

    @property
    def augmentedMessage( self ):
        if self.embededContext is None:
            return self.content
        return (
            f"Use the context below to answer the question.\n"
            f"If the answer isn't in the context, use your own knowledge.\n\n"
            f"Context:\n{self.embededContext}\n\n"
            f"Question: {self.content}"
        )

    def chunkGenerator( self ):
        words = self.content.split()
        for i in range( 0, len( words ), ChunkSize - ChunkOverlap ):
            chunk = ' '.join( words[ i: i + ChunkSize ] )
            if chunk:
                yield Message( self.role, chunk, self.userId, self.roomId )

    def setAugmentedContext( self, context: str ):
        self.embededContext = context

    def getRequestJson( self ):
        return {
            'role': self.role,
            'content': self.augmentedMessage,
        }

    def asDict( self ):
        return {
            'role': self.role,
            'content': self.content,
            'user_id': self.userId,
            'room_id': self.roomId,
        }

class MessageCache:

    def __init__( self, config ):
        self.config = config
        self.messageCaches: list[ Message ] = list()
        self.caches: dict[ dict ] = dict()

    def initialize( self ):
        jsonDicts = readFromJsonFile( self.config.CacheFilePath )
        for jsonDict in jsonDicts:
            msg = Message( jsonDict['role'], jsonDict['content'], jsonDict[ 'user_id' ], jsonDict[ 'room_id' ] )
            self.add( msg )

    def add( self, msg: Message ):
        # self.messageCaches.append( msg )
        userId = msg.userId
        chatRoomId = msg.roomId
        if userId not in self.caches:
            self.caches[ userId ] = dict()

        if chatRoomId not in self.caches[ userId ]:
            self.caches[ userId ][ chatRoomId ] = list()

        self.caches[ userId ][ chatRoomId ].append( msg )

    def getMessageCache( self, userId, roomId ):
        if userId not in self.caches:
            return []
        if roomId is None:
            historicals = []
            for msgs in self.caches[ userId ].values():
                historicals.extend( msgs )
            return historicals
        if roomId not in self.caches[ userId ]:
            return []
        return self.caches[ userId ][ roomId ]

    def toFile( self ):
        jsonDicts = []
        for roomToMsg in self.caches.values():
            for msg in roomToMsg.values():
                jsonDicts.append( msg.asDict() )
        writeToJsonFile( self.config.CacheFilePath, jsonDicts )

class OllamaRequestHandler:

    def __init__( self, config: Config ):
        self.host = config.Host
        self.port = config.Port
        self.model = config.Model
        self.embeddedModel = config.EmbeddedModel

    def initializeCaches( self, messageDicts ):
        ...


    @property
    def chatUrl( self ):
        return f'{self.host}:{self.port}/api/chat'

    @property
    def embeddedUrl( self ):
        return f'{self.host}:{self.port}/api/embeddings'

    def isPersonalFact( self, message: str ) -> bool:
        res = requests.post( self.chatUrl, json={
            'model': self.model,
            'messages': [{
                'role': 'user',
                'content': (
                    f'Does this message state a personal fact worth remembering long term? '
                    f'Reply only YES or NO.\n\nMessage: "{message}"'
                )
            }],
            'stream': False,
        })
        answer = res.json()['message']['content'].strip().upper()
        return answer == 'YES'

    def getEmbeded( self, message: Message ) -> list[ float ]:
        '''
        '''
        response = requests.post( self.embeddedUrl, json={
            'model': self.embeddedModel,
            'prompt': message.content,
        })
        return response.json()[ 'embedding' ]

    def getAIAnswer( self, message: Message, historicalMessages: list[ Message ] = None ) -> list[ float ]:
        '''
        '''
        messages = list()
        if historicalMessages is not None:
            messages = list( map( lambda m: m.getRequestJson(), historicalMessages ) )
        messages.append( message.getRequestJson() )
        res = requests.post( self.chatUrl, json={
            'model': self.model,
            'messages': messages,
            'stream': False,
        })

        responseData = res.json()

        if 'error' in responseData:
            raise ValueError( responseData['error'] )

        print( responseData )

        return responseData['message']

class AIHandler:
    ''' this class will handle the RAG process before sending query to AI
        using embedded technic to convert prompt message to a dimension of meaning

        eg: this is text => [0.1, -0.31, ...] (768 elements)

        the number will computed when input the message. finding the most similar meaning
        and augmented the prompt message by adding context with the similar text score in db

        eg: this is text => 0.4
            input: what is text => 0.48
            augmented is 
            context: this is text
            question: what is text
    '''

    def __init__( self, config: Config, ollamaRequestHandler: OllamaRequestHandler ):

        self.handler = ollamaRequestHandler

        self.dbClient = chromadb.PersistentClient( path = config.VectorDBPath )
        self.dbDocumentCollection = self.dbClient.get_or_create_collection( "documents" )

        self.messageCaches = MessageCache( config )
        self.messageCaches.initialize()

    def initialize( self ):
        '''
        '''

    def indexTextToDb( self, message: Message, source: str = 'unknown' ):

        userId = message.userId

        for msgObj in message.chunkGenerator():

            embededResults = self.handler.getEmbeded( msgObj )

            documentId = getChunkId( userId, source, msgObj.content )

            if self.dbDocumentCollection.get( ids = [documentId,] )[ 'ids' ]:
                self.dbDocumentCollection.update(
                    ids = [ documentId, ],
                    embeddings = [ embededResults, ],
                    documents = [ msgObj.content, ],
                    metadatas=[ { 'source': source, 'user_id': userId, } ],
                )
            else:
                self.dbDocumentCollection.add(
                    ids = [ documentId, ],
                    embeddings = [ embededResults, ],
                    documents = [ msgObj.content, ],
                    metadatas=[ { 'source': source, 'user_id': userId, } ],
                )

    def sendMessage( self, message: str, userId: str = None, roomId: str = None ):

        # construct message object
        msgObj = Message( 'user', message, userId, roomId )

        # get embeded vector dimension score from given message
        embededResults = self.handler.getEmbeded( msgObj )

        # compute to get context that related to given message
        #   using embeded value and in db if there is exists
        if self.dbDocumentCollection.count() != 0:
            # get context from db with embeded value
            relatedEmbededDicts = self.dbDocumentCollection.query(
                query_embeddings = [ embededResults, ],
                n_results=min( 3, self.dbDocumentCollection.count() ),
                where={ 'user_id': userId, }
            )

            # get list of context that related and construct and set to message
            mostRelatedContexts = relatedEmbededDicts[ 'documents' ][ 0 ]
            mostRelatedContextsStr = '\n\n'.join( mostRelatedContexts )
            msgObj.setAugmentedContext( mostRelatedContextsStr )

        try:
            resultMessage = self.handler.getAIAnswer( msgObj, self.messageCaches.getMessageCache( userId, roomId ) )
        except ValueError:
            resultMessage = { 'error': 'Something error' }
        else:
            self.messageCaches.add( msgObj )
            assistantMsg = Message( 'assistant', resultMessage['content'], userId, roomId )
            self.messageCaches.add( assistantMsg )

            if self.handler.isPersonalFact( msgObj.content ):
                self.indexTextToDb( msgObj, source='user' )

        return resultMessage

##############################
#
# Functions
#
