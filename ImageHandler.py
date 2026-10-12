##############################
#
# Standart Import
#
import copy
import glob
import json
import logging
import os
import random
import requests
import shutil
import uuid
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
class ComfyRequestHandler:
    ''' talks to a ComfyUI server over HTTP
        ComfyUI exposes:
            POST /prompt           submit a workflow, returns { prompt_id }
            GET  /history/<id>     status + outputs once finished
            GET  /view             fetch an image file by name/subfolder/type
    '''

    def __init__( self, config: Config ):
        self.url = f'{config.ComfyHost}:{config.ComfyPort}'
        self.model = config.ImageModel
        self.workflowPath = config.ImageWorkflowPath
        self.ipAdapterWorkflowPath = config.ImageIPAdapterWorkflowPath
        self.img2imgWorkflowPath = config.ImageImg2ImgWorkflowPath
        self.denoise = config.ImageDenoise
        self.outputDir = config.ImageOutputDir
        self.charactersDir = config.CharactersDir
        self.width = config.ImageWidth
        self.height = config.ImageHeight
        self.steps = config.ImageSteps
        self.cfg = config.ImageCfg
        self.sampler = config.ImageSampler
        self.scheduler = config.ImageScheduler
        self.negativePrompt = config.ImageNegativePrompt
        self.clientId = str( uuid.uuid4() )
        self._workflowTemplate = None
        self._ipAdapterWorkflowTemplate = None
        self._img2imgWorkflowTemplate = None

    def _loadTemplate( self ):
        if self._workflowTemplate is None:
            with open( self.workflowPath, 'r' ) as f:
                self._workflowTemplate = json.load( f )
        return copy.deepcopy( self._workflowTemplate )

    def _loadIPAdapterTemplate( self ):
        if self._ipAdapterWorkflowTemplate is None:
            with open( self.ipAdapterWorkflowPath, 'r' ) as f:
                self._ipAdapterWorkflowTemplate = json.load( f )
        return copy.deepcopy( self._ipAdapterWorkflowTemplate )

    def _loadImg2ImgTemplate( self ):
        if self._img2imgWorkflowTemplate is None:
            with open( self.img2imgWorkflowPath, 'r' ) as f:
                self._img2imgWorkflowTemplate = json.load( f )
        return copy.deepcopy( self._img2imgWorkflowTemplate )

    def _buildWorkflow( self, prompt: str, negative: str, seed: int ):
        wf = self._loadTemplate()
        wf['3']['inputs']['seed'] = seed
        wf['3']['inputs']['steps'] = self.steps
        wf['3']['inputs']['cfg'] = self.cfg
        wf['3']['inputs']['sampler_name'] = self.sampler
        wf['3']['inputs']['scheduler'] = self.scheduler
        wf['4']['inputs']['ckpt_name'] = self.model
        wf['5']['inputs']['width'] = self.width
        wf['5']['inputs']['height'] = self.height
        wf['6']['inputs']['text'] = prompt
        wf['7']['inputs']['text'] = negative or self.negativePrompt
        return wf

    def submit( self, prompt: str, negative: str = '', seed: int | None = None, characterRefPath: str | None = None, initImagePath: str | None = None, denoise: float | None = None ) -> tuple[ str, int ]:
        if seed is None:
            seed = random.randint( 0, 2**31 - 1 )

        if initImagePath:
            comfyFilename = self._uploadRefImage( initImagePath )
            workflow = self._buildImg2ImgWorkflow( prompt, negative, seed, comfyFilename, denoise )
            logger.info( 'using img2img from %s -> %s (denoise=%s)', initImagePath, comfyFilename, denoise if denoise is not None else self.denoise )
        elif characterRefPath:
            comfyFilename = self._uploadRefImage( characterRefPath )
            workflow = self._buildIPAdapterWorkflow( prompt, negative, seed, comfyFilename )
            logger.info( 'using IP-Adapter with ref %s -> %s', characterRefPath, comfyFilename )
        else:
            workflow = self._buildWorkflow( prompt, negative, seed )

        res = requests.post(
            f'{self.url}/prompt',
            json={ 'prompt': workflow, 'client_id': self.clientId },
            timeout=30,
        )
        if not res.ok:
            # surface ComfyUI's validation error body so the cause is debuggable
            logger.error( 'comfy /prompt returned %d: %s', res.status_code, res.text[:2000] )
            res.raise_for_status()
        data = res.json()
        promptId = data['prompt_id']
        logger.info( 'submitted comfy prompt id=%s seed=%d', promptId, seed )
        return promptId, seed

    def _buildIPAdapterWorkflow( self, prompt: str, negative: str, seed: int, refImageFilename: str ):
        wf = self._loadIPAdapterTemplate()
        wf['3']['inputs']['seed'] = seed
        wf['3']['inputs']['steps'] = self.steps
        wf['3']['inputs']['cfg'] = self.cfg
        wf['3']['inputs']['sampler_name'] = self.sampler
        wf['3']['inputs']['scheduler'] = self.scheduler
        wf['4']['inputs']['ckpt_name'] = self.model
        wf['5']['inputs']['width'] = self.width
        wf['5']['inputs']['height'] = self.height
        wf['6']['inputs']['text'] = prompt
        wf['7']['inputs']['text'] = negative or self.negativePrompt
        wf['12']['inputs']['image'] = refImageFilename
        return wf

    def _buildImg2ImgWorkflow( self, prompt: str, negative: str, seed: int, initImageFilename: str, denoise: float | None ):
        wf = self._loadImg2ImgTemplate()
        wf['3']['inputs']['seed'] = seed
        wf['3']['inputs']['steps'] = self.steps
        wf['3']['inputs']['cfg'] = self.cfg
        wf['3']['inputs']['sampler_name'] = self.sampler
        wf['3']['inputs']['scheduler'] = self.scheduler
        wf['3']['inputs']['denoise'] = denoise if denoise is not None else self.denoise
        wf['4']['inputs']['ckpt_name'] = self.model
        wf['6']['inputs']['text'] = prompt
        wf['7']['inputs']['text'] = negative or self.negativePrompt
        wf['12']['inputs']['image'] = initImageFilename
        return wf

    def _uploadRefImage( self, localPath: str ) -> str:
        ''' upload a local image to ComfyUI's input folder. returns the filename comfy uses.
        '''
        filename = os.path.basename( localPath )
        with open( localPath, 'rb' ) as f:
            files = { 'image': ( filename, f, 'image/png' ) }
            data = { 'overwrite': 'true' }
            res = requests.post( f'{self.url}/upload/image', files=files, data=data, timeout=30 )
        res.raise_for_status()
        result = res.json()
        # ComfyUI returns { name: "...", subfolder: "", type: "input" }
        return result.get( 'name', filename )

    def getHistory( self, promptId: str ) -> dict | None:
        res = requests.get( f'{self.url}/history/{promptId}', timeout=10 )
        res.raise_for_status()
        data = res.json()
        return data.get( promptId )

    def getImageBytes( self, filename: str, subfolder: str, folderType: str ) -> bytes:
        res = requests.get(
            f'{self.url}/view',
            params={ 'filename': filename, 'subfolder': subfolder, 'type': folderType },
            timeout=30,
        )
        res.raise_for_status()
        return res.content

    def getJobStatus( self, promptId: str ) -> dict:
        ''' returns { status: pending|done|error, images: [ {filename, subfolder, type} ], error: str|None }
        '''
        try:
            history = self.getHistory( promptId )
        except requests.RequestException as e:
            logger.error( 'comfy history fetch failed for %s: %s', promptId, e )
            return { 'status': 'error', 'images': [], 'error': str( e ) }

        if not history:
            return { 'status': 'pending', 'images': [], 'error': None }

        status = history.get( 'status', {} )
        if status.get( 'status_str' ) == 'error':
            messages = status.get( 'messages', [] )
            return { 'status': 'error', 'images': [], 'error': str( messages ) }

        outputs = history.get( 'outputs', {} ) or {}
        images = []
        for nodeOutput in outputs.values():
            for img in nodeOutput.get( 'images', [] ) or []:
                images.append({
                    'filename': img['filename'],
                    'subfolder': img.get( 'subfolder', '' ),
                    'type': img.get( 'type', 'output' ),
                })

        if not images:
            return { 'status': 'pending', 'images': [], 'error': None }

        return { 'status': 'done', 'images': images, 'error': None }

    def _localPath( self, userId: str, promptId: str, index: int ) -> str:
        safeUser = userId if userId else 'anonymous'
        dir = os.path.join( self.outputDir, safeUser )
        os.makedirs( dir, exist_ok=True )
        return os.path.join( dir, f'{promptId}_{index}.png' )

    def persistIfDone( self, promptId: str, userId: str | None ) -> dict:
        ''' polls status; if done, writes each image to local disk (idempotent).
            returns status dict with 'local_paths' filled when persisted.
        '''
        status = self.getJobStatus( promptId )
        status['local_paths'] = []
        if status['status'] != 'done':
            return status

        for i, img in enumerate( status['images'] ):
            path = self._localPath( userId or 'anonymous', promptId, i )
            if not os.path.exists( path ):
                try:
                    data = self.getImageBytes( img['filename'], img['subfolder'], img['type'] )
                    with open( path, 'wb' ) as f:
                        f.write( data )
                    logger.info( 'persisted image %s', path )
                except requests.RequestException as e:
                    logger.error( 'persist failed for %s: %s', promptId, e )
                    status['status'] = 'error'
                    status['error'] = f'persist failed: {e}'
                    return status
            status['local_paths'].append( path )
        return status

    def readLocal( self, userId: str | None, promptId: str, index: int ) -> bytes | None:
        path = self._localPath( userId or 'anonymous', promptId, index )
        if not os.path.exists( path ):
            return None
        with open( path, 'rb' ) as f:
            return f.read()

    # ----- character (reference image) management -----

    def _characterDir( self, userId: str, characterId: str ) -> str:
        safeUser = userId if userId else 'anonymous'
        dir = os.path.join( self.charactersDir, safeUser, characterId )
        os.makedirs( dir, exist_ok=True )
        return dir

    def saveCharacterRefs( self, userId: str, characterId: str, imageBytesList: list[ bytes ] ) -> int:
        ''' write each ref as ref_<i>.png. returns the count written.
        '''
        dir = self._characterDir( userId, characterId )
        for i, data in enumerate( imageBytesList ):
            path = os.path.join( dir, f'ref_{i}.png' )
            with open( path, 'wb' ) as f:
                f.write( data )
        logger.info( 'saved %d refs for character %s user %s', len( imageBytesList ), characterId, userId )
        return len( imageBytesList )

    def listCharacterRefs( self, userId: str, characterId: str ) -> list[ str ]:
        dir = self._characterDir( userId, characterId )
        return sorted( glob.glob( os.path.join( dir, 'ref_*.png' ) ) )

    def pickCharacterRef( self, userId: str, characterId: str ) -> str | None:
        refs = self.listCharacterRefs( userId, characterId )
        if not refs:
            return None
        return random.choice( refs )

    def readCharacterRef( self, userId: str, characterId: str, index: int ) -> bytes | None:
        path = os.path.join( self._characterDir( userId, characterId ), f'ref_{index}.png' )
        if not os.path.exists( path ):
            return None
        with open( path, 'rb' ) as f:
            return f.read()

    def deleteCharacter( self, userId: str, characterId: str ) -> bool:
        dir = self._characterDir( userId, characterId )
        if os.path.isdir( dir ):
            shutil.rmtree( dir )
            logger.info( 'deleted character %s for user %s', characterId, userId )
            return True
        return False
