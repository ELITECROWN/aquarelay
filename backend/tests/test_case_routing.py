from test_foundation import client,login,report_payload
from test_launch_workflows import admin


def test_admin_routes_existing_unassigned_case_without_claiming_acknowledgement(client):
    headers=admin(client)
    org=client.post('/api/v1/admin/organisations',headers=headers,json={'name':'Real Field Coordination Team','description':'Review and coordinate documented field observations.'}).json()['id']
    water=client.post('/api/v1/admin/waterbodies',headers=headers,json={'name':'Routing field pond','type':'pond','locality':'Bengaluru','latitude':12.97,'longitude':77.59,'source_name':'Field identity register','license':'CC0-1.0'}).json()['id']
    client.post('/api/v1/auth/logout',headers=headers)
    citizen=login(client)
    report=client.post('/api/v1/reports',headers=citizen,json=report_payload(waterbody_id=water,synthetic=False)).json()
    case_id=report['case_id']
    routing={'organisation_id':org,'source_name':'Platform coordination assignment','reason':'This team agreed to review observations for this water body.','license':'CC0-1.0','assign_existing':True}
    assert client.put(f'/api/v1/admin/waterbodies/{water}/responsibility',headers=citizen,json=routing).status_code==403
    client.post('/api/v1/auth/logout',headers=citizen)
    headers=admin(client)
    unassigned=client.get('/api/v1/admin/unassigned-cases')
    assert unassigned.status_code==200,unassigned.text
    assert case_id in [x['id'] for x in unassigned.json()['items']]
    assigned=client.put(f'/api/v1/admin/waterbodies/{water}/responsibility',headers=headers,json=routing)
    assert assigned.status_code==200,assigned.text
    assert assigned.json()['assigned_cases']==1
    from app.db import SessionLocal
    from app.models import Case,WaterBody
    with SessionLocal() as db:
        case=db.get(Case,case_id)
        assert case.organisation_id==org and case.state=='new'
        assert db.get(WaterBody,water).data['responsible_organisation_id']==org
    assert case_id not in [x['id'] for x in client.get('/api/v1/admin/unassigned-cases').json()['items']]
    passport=client.get('/api/v1/waterbodies/'+water).json()
    assert any(r['kind']=='documented_responsibility' and r['source_id'] for r in passport['relationships'])


def test_admin_cannot_reassign_closed_case(client):
    response=client.post('/api/v1/admin/case-assignments',headers=admin(client),json={'case_id':'case-historical','organisation_id':'org-district','reason':'Requested review by this team.'})
    assert response.status_code==409,response.text
