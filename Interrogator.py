##############################
#
# Standart Import
#
import csv
import io
import logging
import threading

import numpy as np
import onnxruntime as ort
from PIL import Image

from config import Config

##############################
#
# Global Variable
#
logger = logging.getLogger( __name__ )

# WD14 tag CSV categories (from selected_tags.csv schema)
CategoryGeneral = 0
CategoryCharacter = 4
CategoryCopyright = 3
CategoryArtist = 1
CategoryMeta = 5

##############################
#
# Class
#
class WD14Interrogator:
    ''' WD14 tagger: takes an image, returns Danbooru-style tags with confidence scores.
        Model lazy-loaded on first call (so server startup isn't blocked).

        Model output is sigmoid logits over ~9000 tags. Tags are categorized as
        general (most concept tags) or character (specific named characters).
        Different thresholds apply per category.
    '''

    def __init__( self, config: Config ):
        self.modelPath = config.WD14ModelPath
        self.tagsPath = config.WD14TagsPath
        self.generalThreshold = config.WD14GeneralThreshold
        self.characterThreshold = config.WD14CharacterThreshold

        self._session: ort.InferenceSession | None = None
        self._tags: list[ dict ] = []
        self._inputSize: int = 448
        self._loadLock = threading.Lock()

    def _ensureLoaded( self ):
        if self._session is not None:
            return
        with self._loadLock:
            if self._session is not None:
                return
            logger.info( 'loading WD14 model from %s', self.modelPath )
            self._session = ort.InferenceSession( self.modelPath, providers=[ 'CPUExecutionProvider' ] )

            # Infer expected input dimensions from the model
            inputShape = self._session.get_inputs()[ 0 ].shape  # [1, H, W, 3]
            if len( inputShape ) == 4 and isinstance( inputShape[ 1 ], int ):
                self._inputSize = inputShape[ 1 ]

            logger.info( 'loading WD14 tags from %s', self.tagsPath )
            with open( self.tagsPath, 'r', encoding='utf-8' ) as f:
                reader = csv.DictReader( f )
                self._tags = list( reader )
            logger.info( 'WD14 ready: %d tags, input %dx%d', len( self._tags ), self._inputSize, self._inputSize )

    def _preprocess( self, imageBytes: bytes ) -> np.ndarray:
        img = Image.open( io.BytesIO( imageBytes ) ).convert( 'RGB' )

        # Square pad (white background) then resize — standard for WD14
        w, h = img.size
        side = max( w, h )
        canvas = Image.new( 'RGB', ( side, side ), ( 255, 255, 255 ) )
        canvas.paste( img, ( ( side - w ) // 2, ( side - h ) // 2 ) )
        canvas = canvas.resize( ( self._inputSize, self._inputSize ), Image.BICUBIC )

        # WD14 expects BGR order, float32, NO normalization (raw 0-255 values)
        arr = np.asarray( canvas, dtype=np.float32 )
        arr = arr[ :, :, ::-1 ]  # RGB -> BGR
        arr = np.expand_dims( arr, axis=0 )  # batch dim
        return arr

    def interrogate( self, imageBytes: bytes ) -> dict:
        self._ensureLoaded()

        inputTensor = self._preprocess( imageBytes )
        inputName = self._session.get_inputs()[ 0 ].name
        outputs = self._session.run( None, { inputName: inputTensor } )
        scores = outputs[ 0 ][ 0 ]  # [num_tags]

        tags = []
        for i, tagRow in enumerate( self._tags ):
            confidence = float( scores[ i ] )
            category = int( tagRow.get( 'category', 0 ) )
            name = tagRow.get( 'name', '' )

            threshold = self.generalThreshold
            if category == CategoryCharacter:
                threshold = self.characterThreshold
            elif category in ( CategoryArtist, CategoryMeta, CategoryCopyright ):
                # Skip these — not useful as prompt tags for generation
                continue

            if confidence >= threshold:
                # WD14 stores tags with underscores; prompts use spaces
                displayName = name.replace( '_', ' ' )
                tags.append( {
                    'name': displayName,
                    'confidence': round( confidence, 3 ),
                    'category': category,
                } )

        # Sort: characters first (most specific), then by confidence desc
        tags.sort( key=lambda t: ( -1 if t['category'] == CategoryCharacter else 0, -t['confidence'] ) )

        promptString = ', '.join( t['name'] for t in tags )
        return { 'tags': tags, 'prompt_string': promptString }
