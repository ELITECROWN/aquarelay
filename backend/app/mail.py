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
    html = '<div style="background:#f5f5f2;padding:24px;font-family:Arial,sans-serif;color:#24392f"><div style="max-width:560px;margin:auto;background:white;border:1px solid #ddd;border-radius:12px;padding:28px"><h2 style="color:#24392f">AquaRelay<span style="color:#d97706">.</span></h2><h3>'+escape(job.data['subject'])+'</h3><p style="line-height:1.7">'+escape(job.data['message']).replace('\n','<br>')+'</p><p><a style="display:inline-block;background:#f59e0b;color:#1f2937;padding:12px 20px;border-radius:8px;text-decoration:none" href="'+escape(job.data['link'],quote=True)+'">Open AquaRelay</a></p><p style="font-size:12px;color:#667085">Never share your verification code. Manage report-update emails in AquaRelay Settings.</p></div></div>'
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
