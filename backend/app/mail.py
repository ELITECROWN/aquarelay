"""HTTPS transactional email adapters for Render's free hosting."""
import os
from email.utils import parseaddr
from html import escape
import httpx

def configured():
    provider = os.getenv('RESEND_API_KEY') or (os.getenv('MAILJET_API_KEY') and os.getenv('MAILJET_SECRET_KEY'))
    return bool(provider and os.getenv('EMAIL_FROM') and os.getenv('PUBLIC_URL','').startswith('https://'))

def deliver(job):
    if not configured():
        raise ValueError('Transactional email is not configured')
    html = '<p>'+escape(job.data['message'])+'</p><p><a href="'+escape(job.data['link'],quote=True)+'">Open AquaRelay</a></p><p>If you did not request this message, ignore it.</p>'
    with httpx.Client(timeout=15) as client:
        if os.getenv('RESEND_API_KEY'):
            response=client.post('https://api.resend.com/emails',headers={'Authorization':'Bearer '+os.environ['RESEND_API_KEY'],'Idempotency-Key':job.id},json={'from':os.environ['EMAIL_FROM'],'to':[job.data['to']],'subject':job.data['subject'],'html':html})
        else:
            name,address=parseaddr(os.environ['EMAIL_FROM'])
            response=client.post('https://api.mailjet.com/v3.1/send',auth=(os.environ['MAILJET_API_KEY'],os.environ['MAILJET_SECRET_KEY']),json={'Messages':[{'From':{'Email':address,'Name':name or 'AquaRelay'},'To':[{'Email':job.data['to']}],'Subject':job.data['subject'],'HTMLPart':html,'CustomID':job.id}]})
    if response.status_code not in {200,201}:
        raise ValueError('Transactional email provider rejected delivery')
    if not os.getenv('RESEND_API_KEY') and any(item.get('Status')!='success' for item in response.json().get('Messages',[])):
        raise ValueError('Transactional email provider rejected delivery')
