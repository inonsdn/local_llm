##############################
#
# Standart Import
#
import logging
import os
import tempfile

import requests
from fastapi import Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from ImageHandler import ComfyRequestHandler

##############################
#
# Global Variable
#
logger = logging.getLogger( 'plugins.image' )

##############################
#
# Class
#
class ImageRequest( BaseModel ):
    prompt: str
    negative: str | None = None
    seed: int | None = None
    user_id: str | None = None
    character_id: str | None = None

##############################
#
# Plugin Entry
#
def register( ctx ):
    ''' image generation + character reference management.

        backed by a ComfyUI server ( see config.ComfyHost / ComfyPort ). the
        handler is built here, so when this plugin folder is absent the server
        never touches ComfyUI at all.
    '''
    app = ctx.app
    config = ctx.config
    verifyApiKey = ctx.verifyApiKey
    parseUUID = ctx.parseUUID

    imageHandler = ComfyRequestHandler( config )
    ctx.provide( 'imageHandler', imageHandler )

    @app.post( '/image' )
    def submitImage( req: ImageRequest, _: None = Depends( verifyApiKey ) ):
        userKey = parseUUID( req.user_id, 'user_id' ) if req.user_id else None
        logger.info( 'image request user=%s character=%s prompt=%r', req.user_id, req.character_id, req.prompt[ :80 ] )

        refPath = None
        if req.character_id and userKey:
            refPath = imageHandler.pickCharacterRef( userKey, req.character_id )
            if not refPath:
                raise HTTPException( status_code=404, detail='Character has no reference images' )

        try:
            promptId, usedSeed = imageHandler.submit(
                prompt=req.prompt,
                negative=req.negative or '',
                seed=req.seed,
                characterRefPath=refPath,
            )
        except requests.RequestException as e:
            logger.error( 'comfy submit failed: %s', e )
            raise HTTPException( status_code=502, detail='Image backend unavailable' )
        return { 'job_id': promptId, 'seed': usedSeed }

    @app.post( '/image/oneshot' )
    async def submitImageOneshot(
        prompt: str = Form( ... ),
        negative: str = Form( '' ),
        seed: int | None = Form( None ),
        mode: str = Form( 'ipadapter' ),
        denoise: float | None = Form( None ),
        ref: UploadFile | None = File( None ),
        _: None = Depends( verifyApiKey ),
    ):
        ''' stateless generation. the reference image (if any) is passed inline and
            discarded after submit; nothing is persisted as a character.

            mode = 'ipadapter' -> ref drives IP-Adapter likeness (new scene)
            mode = 'img2img'   -> ref is re-rendered, keeping its composition;
                                  closeness controlled by denoise (lower = closer)
        '''
        logger.info( 'oneshot image request mode=%s prompt=%r ref=%s', mode, prompt[ :80 ], ref is not None )

        refPath = None
        tmpPath = None
        try:
            if ref is not None:
                data = await ref.read()
                if data:
                    fd, tmpPath = tempfile.mkstemp( suffix='.png', prefix='oneshot_' )
                    with os.fdopen( fd, 'wb' ) as f:
                        f.write( data )
                    refPath = tmpPath

            useImg2Img = mode == 'img2img' and refPath is not None
            try:
                promptId, usedSeed = imageHandler.submit(
                    prompt=prompt,
                    negative=negative or '',
                    seed=seed,
                    characterRefPath=None if useImg2Img else refPath,
                    initImagePath=refPath if useImg2Img else None,
                    denoise=denoise,
                )
            except requests.RequestException as e:
                logger.error( 'comfy oneshot submit failed: %s', e )
                raise HTTPException( status_code=502, detail='Image backend unavailable' )
        finally:
            # ComfyUI already has its own copy after submit; drop the local temp
            if tmpPath and os.path.exists( tmpPath ):
                os.remove( tmpPath )

        return { 'job_id': promptId, 'seed': usedSeed }

    @app.get( '/image/{job_id}' )
    def getImage( job_id: str, user_id: str | None = None, _: None = Depends( verifyApiKey ) ):
        userKey = parseUUID( user_id, 'user_id' ) if user_id else None
        status = imageHandler.persistIfDone( job_id, userKey )
        if status[ 'status' ] == 'done':
            count = len( status[ 'images' ] )
            return {
                'status': 'done',
                'count': count,
                'images': [ f'/image/{job_id}/file?index={i}&user_id={user_id}' for i in range( count ) ],
            }
        return { 'status': status[ 'status' ], 'error': status.get( 'error' ) }

    @app.get( '/image/{job_id}/file' )
    def getImageFile( job_id: str, index: int = 0, user_id: str | None = None, _: None = Depends( verifyApiKey ) ):
        userKey = parseUUID( user_id, 'user_id' ) if user_id else None

        # try local first
        data = imageHandler.readLocal( userKey, job_id, index )
        if data is not None:
            return Response( content=data, media_type='image/png' )

        # fall back to live ComfyUI ( also persists )
        status = imageHandler.persistIfDone( job_id, userKey )
        if status[ 'status' ] != 'done':
            raise HTTPException( status_code=404, detail=f'Image not ready: {status["status"]}' )
        if index >= len( status[ 'images' ] ):
            raise HTTPException( status_code=404, detail='Image index out of range' )
        data = imageHandler.readLocal( userKey, job_id, index )
        if data is None:
            raise HTTPException( status_code=502, detail='Failed to read persisted image' )
        return Response( content=data, media_type='image/png' )

    @app.post( '/character' )
    async def uploadCharacter(
        user_id: str = Form( ... ),
        character_id: str = Form( ... ),
        files: list[ UploadFile ] = File( ... ),
        _: None = Depends( verifyApiKey ),
    ):
        userKey = parseUUID( user_id, 'user_id' )
        if not character_id:
            raise HTTPException( status_code=422, detail='character_id required' )
        if not files or len( files ) > 4:
            raise HTTPException( status_code=422, detail='Provide 1-4 reference images' )

        blobs = []
        for f in files:
            data = await f.read()
            if not data:
                raise HTTPException( status_code=422, detail='Empty file' )
            blobs.append( data )

        count = imageHandler.saveCharacterRefs( userKey, character_id, blobs )
        return { 'character_id': character_id, 'ref_count': count }

    @app.get( '/character/{character_id}/ref/{index}' )
    def getCharacterRef( character_id: str, index: int, user_id: str, _: None = Depends( verifyApiKey ) ):
        userKey = parseUUID( user_id, 'user_id' )
        data = imageHandler.readCharacterRef( userKey, character_id, index )
        if data is None:
            raise HTTPException( status_code=404, detail='Reference not found' )
        return Response( content=data, media_type='image/png' )

    @app.delete( '/character/{character_id}' )
    def deleteCharacter( character_id: str, user_id: str, _: None = Depends( verifyApiKey ) ):
        userKey = parseUUID( user_id, 'user_id' )
        imageHandler.deleteCharacter( userKey, character_id )
        return { 'status': 'deleted' }
