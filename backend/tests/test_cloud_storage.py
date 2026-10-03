import httpx
import pytest

def test_cloud_storage_uses_private_bucket_and_round_trips():
    from app.storage import SupabaseStorage
    objects={}
    def handle(request):
        assert request.headers['authorization']=='Bearer test-secret'
        key=request.url.path
        if request.method=='POST': objects[key]=request.content;return httpx.Response(200,json={'Key':key})
        if request.method=='GET': return httpx.Response(200,content=objects[key])
        if request.method=='DELETE': return httpx.Response(200,json=[])
    storage=SupabaseStorage('https://test.supabase.co','test-secret','evidence',transport=httpx.MockTransport(handle))
    original,public=storage.save('evidence-1',b'private',b'clean','.jpg')
    assert original.startswith('supabase://evidence/private/')
    assert storage.read(public)==b'clean'
    assert storage.read(original)==b'private'
    with pytest.raises(ValueError):storage.read('supabase://other/private/a.bin')
    with pytest.raises(ValueError):storage.save('../bad',b'x',b'y','.jpg')

def test_cloud_storage_does_not_expose_provider_error_or_key():
    from app.storage import SupabaseStorage
    from fastapi import HTTPException
    storage=SupabaseStorage('https://test.supabase.co','secret','evidence',transport=httpx.MockTransport(lambda r:httpx.Response(401,text='secret provider body')))
    with pytest.raises(HTTPException) as error: storage.save('evidence-1',b'x',b'y','.jpg')
    assert error.value.status_code==503
    assert 'secret' not in str(error.value.detail)
