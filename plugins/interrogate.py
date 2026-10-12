##############################
#
# Standart Import
#
import logging

from fastapi import Depends, File, HTTPException, UploadFile

from Interrogator import WD14Interrogator

##############################
#
# Global Variable
#
logger = logging.getLogger( 'plugins.interrogate' )

##############################
#
# Plugin Entry
#
def register( ctx ):
    ''' WD14 image interrogator: image bytes in, Danbooru-style tags out.

        this is a single-file plugin ( plugins/interrogate.py ) to show a
        plugin needs no folder. the WD14 model is lazy-loaded on first call.
    '''
    app = ctx.app
    config = ctx.config
    verifyApiKey = ctx.verifyApiKey

    interrogator = WD14Interrogator( config )
    ctx.provide( 'interrogator', interrogator )

    @app.post( '/interrogate' )
    async def interrogateImage( file: UploadFile = File( ... ), _: None = Depends( verifyApiKey ) ):
        data = await file.read()
        if not data:
            raise HTTPException( status_code=422, detail='Empty file' )
        logger.info( 'interrogate request size=%d', len( data ) )
        try:
            result = interrogator.interrogate( data )
        except FileNotFoundError as e:
            logger.error( 'WD14 model missing: %s', e )
            raise HTTPException( status_code=503, detail='Interrogator model not installed' )
        except Exception as e:
            logger.error( 'interrogate failed: %s', e )
            raise HTTPException( status_code=500, detail='Interrogation failed' )
        return result
