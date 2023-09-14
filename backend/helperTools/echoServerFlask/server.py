from flask import Flask, request, jsonify, make_response
from flask_cors import CORS, cross_origin
app = Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'

# py version +3.10 support
import collections
import sys
if(sys.version_info >= (3, 10)):
    collections.MutableSet = collections.abc.MutableSet

@app.route('/upload_author_list', methods=['POST'])
@cross_origin()
def handle_upload_author_list():
    content_type = request.headers.get('Content-Type')
    if (content_type == 'application/json'):
        content = request.json
        
        for k, v in content.items():
            if(isinstance(v, list)):
                # print list
                print(k, "(list len: " + str(len(v)) + ")")
                for item in v:
                    print(item)
            else:
                print(k, ": ", v)
        
        return make_response("", 200)
    else:
        return make_response("Content-Type not allowed", 400)
        
if __name__ == '__main__':
    app.run(host= '0.0.0.0', debug=True)