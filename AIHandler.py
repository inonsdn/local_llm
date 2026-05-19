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
from supabase import create_client as createSupabaseClient
import logging
import threading

##############################
#
# Global Variable
#
logger = logging.getLogger( __name__ )

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
        if self.config.SupabaseUrl and self.config.SupabaseKey:
            self._loadFromSupabase()
        else:
            self._loadFromFile()

    def _loadFromFile( self ):
        logger.info( 'loading message cache from file: %s', self.config.CacheFilePath )
        jsonDicts = readFromJsonFile( self.config.CacheFilePath )
        for jsonDict in jsonDicts:
            msg = Message( jsonDict['role'], jsonDict['content'], jsonDict.get( 'user_id' ), jsonDict.get( 'room_id' ) )
            self.add( msg )
        logger.info( 'loaded %d messages from file', len( jsonDicts ) )

    def _loadFromSupabase( self ):
        logger.info( 'loading message cache from Supabase' )
        db = createSupabaseClient( self.config.SupabaseUrl, self.config.SupabaseKey )
        result = (
            db.from_( 'chat_messages' )
            .select( 'id, room_id, role, content, created_at, chat_rooms(user_id)' )
            .order( 'created_at', desc=True )
            .limit( 500 )
            .execute()
        )
        for row in reversed( result.data ):
            userId = row['chat_rooms']['user_id'] if row.get( 'chat_rooms' ) else None
            msg = Message( row['role'], row['content'], userId, row['room_id'] )
            self.add( msg )
        logger.info( 'loaded %d messages from Supabase', len( result.data ) )

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
        for roomToMsgs in self.caches.values():
            for msgs in roomToMsgs.values():
                for msg in msgs:
                    jsonDicts.append( msg.asDict() )
        writeToJsonFile( self.config.CacheFilePath, jsonDicts )

    def clear( self, userId, roomId ):
        if userId not in self.caches:
            logger.debug( 'clear: no cache found for user=%s', userId )
            return
        if roomId not in self.caches[ userId ]:
            logger.debug( 'clear: no cache found for user=%s room=%s', userId, roomId )
            return
        count = len( self.caches[ userId ][ roomId ] )
        self.caches[ userId ][ roomId ].clear()
        logger.info( 'cleared %d cached messages for user=%s room=%s', count, userId, roomId )
class OllamaRequestHandler:

    def __init__( self, config: Config ):
        self.host = config.Host
        self.port = config.Port
        self.model = config.Model
        self.embeddedModel = config.EmbeddedModel

    @property
    def chatUrl( self ):
        return f'{self.host}:{self.port}/api/chat'

    @property
    def embeddedUrl( self ):
        return f'{self.host}:{self.port}/api/embeddings'

    def isPersonalFact( self, message: str ) -> bool:
        ''' request prompt to ai for check that is this personal data fact
        '''
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
        try:
            answer = res.json()['message']['content'].strip().upper()
        except Exception as e:
            logger.error( 'isPersonalFact parse error: %s', e )
            return False
        return answer == 'YES'

    def getEmbeded( self, message: Message ) -> list[ float ]:
        ''' request to ai for embeded message to vector of meaning of it
            result is meaning of message in float for use to compute in math
        '''
        response = requests.post( self.embeddedUrl, json={
            'model': self.embeddedModel,
            'prompt': message.content,
        })
        return response.json()[ 'embedding' ]

    def getAIAnswer( self, message: Message, historicalMessages: list[ Message ] = None ) -> list[ float ]:
        ''' request to ai of given message and historical message
        '''
        # init list of message data dict of historical if exists
        messages = list()
        if historicalMessages is not None:
            messages = list( map( lambda m: m.getRequestJson(), historicalMessages ) )
        
        # add current message into list
        messages.append( message.getRequestJson() )

        # request to ai
        res = requests.post( self.chatUrl, json={
            'model': self.model,
            'messages': messages,
            'stream': False,
        })

        # get response from packet
        responseData = res.json()

        # handle when received error
        if 'error' in responseData:
            logger.error( 'Ollama error: %s', responseData['error'] )
            raise ValueError( responseData['error'] )

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

        logger.info( 'connecting to vector DB at %s', config.VectorDBPath )
        self.dbClient = chromadb.PersistentClient( path = config.VectorDBPath )
        self.dbDocumentCollection = self.dbClient.get_or_create_collection( "documents" )
        logger.info( 'vector DB ready, %d documents indexed', self.dbDocumentCollection.count() )

        self.messageCaches = MessageCache( config )
        self.messageCaches.initialize()

    def indexTextToDb( self, message: Message, source: str = 'unknown' ):
        ''' store message into vector db for index text to using in retrive process of RAG
            this will chunk message to a size for store into vector to prevent hallucinate 
            when provide context to ai

            store value is vector of embeded that will get from ai model in each documents
        '''
        userId = message.userId
        logger.debug( 'indexing text for user=%s source=%s', userId, source )

        for msgObj in message.chunkGenerator():

            embededResults = self.handler.getEmbeded( msgObj )
            documentId = getChunkId( userId, source, msgObj.content )
            logger.debug( 'upserting chunk %s', documentId )

            self.dbDocumentCollection.upsert(
                ids = [ documentId, ],
                embeddings = [ embededResults, ],
                documents = [ msgObj.content, ],
                metadatas=[ { 'source': source, 'user_id': userId, } ],
            )

    def sendMessage( self, message: str, userId: str = None, roomId: str = None ):
        '''
        '''
        # construct message object
        msgObj = Message( 'user', message, userId, roomId )

        # get embeded vector dimension score from given message
        embededResults = self.handler.getEmbeded( msgObj )

        if self.dbDocumentCollection.count() != 0:
            relatedEmbededDicts = self.dbDocumentCollection.query(
                query_embeddings = [ embededResults, ],
                n_results=min( 3, self.dbDocumentCollection.count() ),
                where={ 'user_id': userId, }
            )
            mostRelatedContexts = relatedEmbededDicts[ 'documents' ][ 0 ]
            logger.debug( 'RAG retrieved %d context chunks for user=%s', len( mostRelatedContexts ), userId )
            mostRelatedContextsStr = '\n\n'.join( mostRelatedContexts )
            msgObj.setAugmentedContext( mostRelatedContextsStr )

        logger.info( 'sending message user=%s room=%s', userId, roomId )
        try:
            resultMessage = self.handler.getAIAnswer( msgObj, self.messageCaches.getMessageCache( userId, roomId ) )
        except ValueError as e:
            logger.error( 'AI returned error for user=%s room=%s: %s', userId, roomId, e )
            resultMessage = { 'error': 'Something error' }
        else:
            logger.debug( 'AI response received for user=%s room=%s', userId, roomId )
            self.messageCaches.add( msgObj )
            assistantMsg = Message( 'assistant', resultMessage['content'], userId, roomId )
            self.messageCaches.add( assistantMsg )

            def _indexIfPersonalFact( msg ):
                logger.debug( 'checking personal fact for user=%s', userId )
                if self.handler.isPersonalFact( msg.content ):
                    logger.info( 'indexing personal fact for user=%s', userId )
                    self.indexTextToDb( msg, source='user' )
            threading.Thread( target=_indexIfPersonalFact, args=( msgObj, ), daemon=True ).start()

        return resultMessage

##############################
#
# Functions
#
