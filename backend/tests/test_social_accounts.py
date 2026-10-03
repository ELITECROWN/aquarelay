from test_foundation import client,login
from test_launch_workflows import admin


def approval():
    return {'organisation_id':'org-reedwatch','platform':'x','handle':'ReedwatchTest','account_url':'https://x.com/ReedwatchTest','verification_source':'https://example.org/organisation/contact','review_confirmed':True}


def test_social_suggestions_require_admin_review_and_relevance_and_can_be_revoked(client):
    body=approval()
    assert client.post('/api/v1/admin/social-accounts',json=body,headers=login(client)).status_code==403
    headers=admin(client)
    saved=client.post('/api/v1/admin/social-accounts',json=body,headers=headers)
    assert saved.status_code==201,saved.text
    account_id=saved.json()['id']
    suggestions=client.get('/api/v1/waterbodies/wb-reedwater/social-accounts').json()
    assert [x['id'] for x in suggestions['items']]==[account_id]
    assert suggestions['items'][0]['verification_source']==body['verification_source']
    assert suggestions['automatic_tagging'] is False
    assert client.get('/api/v1/waterbodies/wb-millbank/social-accounts').json()['items']==[]
    assert client.post('/api/v1/admin/social-accounts',json=body,headers=headers).status_code==409
    assert client.post(f'/api/v1/admin/social-accounts/{account_id}/revoke',json={'organisation_id':'org-reedwatch'},headers=headers).status_code==200
    assert client.get('/api/v1/waterbodies/wb-reedwater/social-accounts').json()['items']==[]


def test_social_approval_rejects_unreviewed_mismatched_or_unsafe_links(client):
    headers=admin(client)
    for change in [{'review_confirmed':False},{'account_url':'https://evil.example/ReedwatchTest'},{'account_url':'https://x.com/OtherAccount'},{'account_url':'https://x.com/ReedwatchTest?redirect=evil'},{'verification_source':'http://example.org/contact'},{'verification_source':'https://user:password@example.org/contact'}]:
        response=client.post('/api/v1/admin/social-accounts',json={**approval(),**change},headers=headers)
        assert response.status_code==422,response.text
