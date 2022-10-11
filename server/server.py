from flask import Flask, request, jsonify, make_response
from flask_cors import CORS, cross_origin
app = Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'

@app.route('/upload_author_list', methods=['POST'])
@cross_origin()
def handle_upload_author_list():
    content_type = request.headers.get('Content-Type')
    if (content_type == 'application/json'):
        content = request.json
        
        if 'name' in content:
            print(content['name'])
        else:
            print("wrong content name")
            
        if 'authList' in content:
            print(content['authList'])
        else:
            print("wrong content authList")
            
        if 'log' in content:
            print(content['log'])
        else:
            print("wrong content log")
        
        
        return make_response("", 200)
    else:
        return make_response("Content-Type not allowed", 400)
        
    

if __name__ == '__main__':
    app.run(host= '0.0.0.0', debug=True)