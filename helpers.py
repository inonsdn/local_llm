##############################
#
# Standart Import
#
import importlib.util
import json
import logging
import os

import requests


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
    logger.debug( 'writing %d records to %s', len( jsonDicts ), filePath )
    with open( filePath, 'w' ) as f:
        f.write( json.dumps( jsonDicts ) )

def readFromJsonFile( filePath ):
    if not os.path.exists( filePath ):
        logger.debug( 'file not found, returning empty list: %s', filePath )
        return []
    with open( filePath, 'r' ) as f:
        data = json.loads( f.read() )
    logger.debug( 'read %d records from %s', len( data ), filePath )
    return data

def loadConfig( configPath ):
    spec = importlib.util.spec_from_file_location( 'config', configPath )
    module = importlib.util.module_from_spec( spec )
    spec.loader.exec_module( module )
    return module.Config
