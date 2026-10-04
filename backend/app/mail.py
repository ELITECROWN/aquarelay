"""HTTPS transactional email adapters for Render's free hosting."""
import os
from email.utils import parseaddr
from html import escape
import httpx
import base64
from email.message import EmailMessage

def provider():
    return os.getenv('EMAIL_PROVIDER') or ('resend' if os.getenv('RESEND_API_KEY') else 'mailjet')

def configured():
    credentials = {'gmail': all(os.getenv('GMAIL_'+key) for key in ('CLIENT_ID','CLIENT_SECRET','REFRESH_TOKEN')), 'resend': bool(os.getenv('RESEND_API_KEY')), 'mailjet': bool(os.getenv('MAILJET_API_KEY') and os.getenv('MAILJET_SECRET_KEY'))}
    return bool(credentials.get(provider()) and os.getenv('EMAIL_FROM') and os.getenv('PUBLIC_URL','').startswith('https://'))

def deliver(job):
    if not configured():
        raise ValueError('Transactional email is not configured')
    html = '<div style="background:#f5f5f2;padding:24px;font-family:Arial,sans-serif;color:#24392f"><div style="max-width:560px;margin:auto;background:white;border:1px solid #ddd;border-radius:12px;padding:28px"><h2 style="color:#24392f">AquaRelay<span style="color:#d97706">.</span></h2><h3>'+escape(job.data['subject'])+'</h3><p style="line-height:1.7">'+escape(job.data['message']).replace('\n','<br>')+'</p><p><a style="display:inline-block;background:#f59e0b;color:#1f2937;padding:12px 20px;border-radius:8px;text-decoration:none" href="'+escape(job.data['link'],quote=True)+'">Open AquaRelay</a></p><p style="font-size:12px;color:#667085">Never share your verification code. Manage report-update emails in AquaRelay Settings.</p></div></div>'
    with httpx.Client(timeout=15) as client:
        if provider() == 'gmail':
            token=client.post('https://oauth2.googleapis.com/token',data={'client_id':os.environ['GMAIL_CLIENT_ID'],'client_secret':os.environ['GMAIL_CLIENT_SECRET'],'refresh_token':os.environ['GMAIL_REFRESH_TOKEN'],'grant_type':'refresh_token'})
            if token.status_code != 200 or not token.json().get('access_token'):
                raise ValueError('Gmail authorization failed; reauthorize the sender account')
            message=EmailMessage()
            message['From']=os.environ['EMAIL_FROM']
            message['To']=job.data['to']
            message['Subject']=job.data['subject']
            message['Message-ID']='<'+job.id+'@aquarelay.local>'
            message.set_content(job.data['message']+'\n\n'+job.data['link'])
            message.add_alternative(html,subtype='html')
            response=client.post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',headers={'Authorization':'Bearer '+token.json()['access_token']},json={'raw':base64.urlsafe_b64encode(message.as_bytes()).decode('ascii')})
        elif provider() == 'resend':
            response=client.post('https://api.resend.com/emails',headers={'Authorization':'Bearer '+os.environ['RESEND_API_KEY'],'Idempotency-Key':job.id},json={'from':os.environ['EMAIL_FROM'],'to':[job.data['to']],'subject':job.data['subject'],'html':html})
        else:
            name,address=parseaddr(os.environ['EMAIL_FROM'])
            response=client.post('https://api.mailjet.com/v3.1/send',auth=(os.environ['MAILJET_API_KEY'],os.environ['MAILJET_SECRET_KEY']),json={'Messages':[{'From':{'Email':address,'Name':name or 'AquaRelay'},'To':[{'Email':job.data['to']}],'Subject':job.data['subject'],'HTMLPart':html,'CustomID':job.id}]})
    if response.status_code not in {200,201}:
        raise ValueError('Transactional email provider rejected delivery')
    if provider() == 'mailjet' and any(item.get('Status')!='success' for item in response.json().get('Messages',[])):
        raise ValueError('Transactional email provider rejected delivery')
