##############################
#
# Standart Import
#
import importlib.util
import json
import os

import requests


##############################
#
# Global Variable
#
##############################
#
# Helpers Funciton
#
def writeToJsonFile( filePath, jsonDicts ):
    with open( filePath, 'w' ) as f:
        f.write( json.dumps( jsonDicts ) )

def readFromJsonFile( filePath ):
    if not os.path.exists( filePath ):
        return []
    with open( filePath, 'r' ) as f:
        return json.loads( f.read() )

def loadConfig( configPath ):
    spec = importlib.util.spec_from_file_location( 'config', configPath )
    module = importlib.util.module_from_spec( spec )
    spec.loader.exec_module( module )
    return module.Config
