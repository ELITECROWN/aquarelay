"""One-time local OAuth setup. Never prints credentials or tokens."""
import argparse
import base64
import hashlib
import json
import secrets
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlencode, urlparse, parse_qs
import httpx

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('credentials',help='Path to downloaded Desktop client JSON')
    args=parser.parse_args()
    credentials=json.loads(Path(args.credentials).read_text(encoding='utf-8'))['installed']
    state=secrets.token_urlsafe(32)
    verifier=secrets.token_urlsafe(64)
    challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
    result={}
    class Callback(BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def do_GET(self):
            query=parse_qs(urlparse(self.path).query)
            valid=urlparse(self.path).path=='/' and query.get('state')==[state]
            self.send_response(200 if valid else 400)
            self.end_headers()
            self.wfile.write(b'Authorization received. You can close this tab.' if valid else b'Invalid callback.')
            if valid:
                result.update(query)
    with HTTPServer(('127.0.0.1',0),Callback) as server:
        server.timeout=1
        redirect='http://127.0.0.1:'+str(server.server_port)+'/'
        url='https://accounts.google.com/o/oauth2/v2/auth?'+urlencode({'client_id':credentials['client_id'],'redirect_uri':redirect,'response_type':'code','scope':'https://www.googleapis.com/auth/gmail.send','access_type':'offline','prompt':'consent','state':state,'code_challenge':challenge,'code_challenge_method':'S256','login_hint':'memeemotive@gmail.com'})
        print('Opening Google. Authorize the sender Gmail account. Waiting up to five minutes...')
        webbrowser.open(url)
        deadline=time.monotonic()+300
        while not result and time.monotonic()<deadline:
            server.handle_request()
    if not result.get('code'):
        raise SystemExit('Authorization cancelled or timed out. No credentials saved.')
    response=httpx.post('https://oauth2.googleapis.com/token',data={'client_id':credentials['client_id'],'client_secret':credentials['client_secret'],'code':result['code'][0],'redirect_uri':redirect,'grant_type':'authorization_code','code_verifier':verifier},timeout=20)
    if response.status_code!=200 or not response.json().get('refresh_token'):
        raise SystemExit('Google did not issue a refresh token. Check client setup and retry.')
    values={'EMAIL_PROVIDER':'gmail','GMAIL_CLIENT_ID':credentials['client_id'],'GMAIL_CLIENT_SECRET':credentials['client_secret'],'GMAIL_REFRESH_TOKEN':response.json()['refresh_token'],'EMAIL_FROM':'AquaRelay <memeemotive@gmail.com>','EMAIL_OTP_REQUIRED':'true'}
    output=Path(__file__).resolve().parent/'gmail-render.env'
    output.write_text('\n'.join(key+'='+value for key,value in values.items())+'\n',encoding='utf-8')
    print('Saved private settings to '+str(output))
    print('Copy them into Render Environment. Do not share this file or commit it.')

if __name__=='__main__':
    main()
