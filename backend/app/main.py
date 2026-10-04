import os
import threading
import time
from collections import defaultdict,deque
from contextlib import asynccontextmanager
from fastapi import FastAPI,HTTPException,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from pathlib import Path
from .db import Base,engine,SessionLocal
from . import models
from .auth import router as auth_router,validate_csrf
from .core import router as core_router,DEMO_MODE
from .assistance import router as assistance_router
from .workspace import router as workspace_router
from .push import router as push_router
from .cleanup import router as cleanup_router

@asynccontextmanager
async def lifespan(app):
    if DEMO_MODE:
        Base.metadata.create_all(engine)
        from .seed import seed
        with SessionLocal() as db: seed(db)
    stop=threading.Event()
    worker=None
    if os.getenv("EMBEDDED_WORKER","true").lower()=="true":
        from .worker import run_worker
        worker=threading.Thread(target=run_worker,args=(stop,),daemon=True); worker.start()
    yield
    stop.set()
    if worker: worker.join(timeout=3)

app=FastAPI(title="AquaRelay Public and Organisation API",version="1.0.0",description="Source-linked freshwater registry. Public responses exclude private notes, contacts and media originals. Demo content is synthetic.",lifespan=lifespan,docs_url="/api/docs",redoc_url="/api/redoc",openapi_url="/api/openapi.json")
origins=[s.strip() for s in os.getenv("CORS_ORIGINS","http://localhost:5173,http://127.0.0.1:5173").split(",") if s.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=True,allow_methods=["GET","POST","PUT","DELETE","OPTIONS"],allow_headers=["Content-Type","X-CSRF-Token","Last-Event-ID","X-Webhook-Signature"])
traffic=defaultdict(deque)
auth_traffic=defaultdict(deque)

@app.middleware("http")
async def security_middleware(request:Request,call_next):
    client=request.client.host if request.client else "unknown"
    window=traffic[client]
    now=time.monotonic()
    while window and window[0]<now-60: window.popleft()
    if len(window)>=240: return JSONResponse({"detail":"Request limit reached. Retry shortly."},status_code=429,headers={"Retry-After":"60"})
    window.append(now)
    if request.method=="POST" and request.url.path.startswith('/api/v1/auth/'):
        auth_window=auth_traffic[client]
        while auth_window and auth_window[0]<now-60: auth_window.popleft()
        if len(auth_window)>=15: return JSONResponse({"detail":"Sign-in attempt limit reached. Retry in one minute."},status_code=429)
        auth_window.append(now)
    if request.method in {"POST","PUT","PATCH","DELETE"} and request.url.path.startswith("/api/v1/") and not request.url.path.startswith("/api/v1/webhooks/"):
        origin=request.headers.get("origin")
        if origin and origin not in origins:
            return JSONResponse({"detail":"Unapproved request origin."},status_code=403)
        try:
            with SessionLocal() as db: validate_csrf(request,db)
        except HTTPException as exc:
            return JSONResponse({"detail":exc.detail},status_code=exc.status_code)
    response=await call_next(request)
    response.headers["X-Content-Type-Options"]="nosniff"
    response.headers["Referrer-Policy"]="strict-origin-when-cross-origin"
    return response

app.include_router(auth_router,prefix="/api/v1",tags=["authentication"])
app.include_router(core_router,prefix="/api/v1",tags=["registry and workflow"])
app.include_router(assistance_router,prefix="/api/v1",tags=["non-authoritative drafts"])
app.include_router(workspace_router,prefix="/api/v1",tags=["professional contributions"])
app.include_router(push_router,prefix='/api/v1',tags=['browser notifications'])
app.include_router(cleanup_router,prefix='/api/v1',tags=['administrator cleanup'])
from .admin_records import router as admin_records_router
app.include_router(admin_records_router,prefix='/api/v1',tags=['administrator records'])
try:
    from .integrations import router as integrations_router
    app.include_router(integrations_router,prefix="/api/v1",tags=["interoperability"])
except ImportError as exc:
    if exc.name not in {"app.integrations","app.standards"}: raise

@app.get("/health")
def health():
    with SessionLocal() as db: db.connection().exec_driver_sql("SELECT 1")
    return {"status":"ok","database":engine.dialect.name,"demo_mode":DEMO_MODE}

@app.get('/ready')
def readiness():
    try:
        with SessionLocal() as db:
            connection=db.connection()
            for table in ('waterbodies','users','sessions','events','jobs'):
                connection.exec_driver_sql(f'SELECT 1 FROM {table} LIMIT 0')
            if not DEMO_MODE:
                if engine.dialect.name!='postgresql':raise RuntimeError('Production database required')
                revision=connection.exec_driver_sql('SELECT version_num FROM alembic_version').scalar()
                if revision!='002_postgis_spatial':raise RuntimeError('Migration version mismatch')
                connection.exec_driver_sql('SELECT PostGIS_Version()')
                connection.exec_driver_sql('SELECT geog,geom FROM waterbodies LIMIT 0')
        return {'status':'ready','production':not DEMO_MODE}
    except Exception:
        # Never publish connection strings, credentials or database diagnostics.
        return JSONResponse(status_code=503,content={'status':'unavailable','production':not DEMO_MODE})

static_path=os.getenv("STATIC_PATH")
if static_path:
    static_root=Path(static_path).resolve()
    @app.get("/{path:path}",include_in_schema=False)
    def spa(path:str):
        if path=="api" or path.startswith("api/"):
            raise HTTPException(404,"API route not found.")
        target=(static_root/path).resolve()
        if target.is_relative_to(static_root) and target.is_file():
            return FileResponse(target)
        index=static_root/"index.html"
        if not index.exists(): raise HTTPException(503,"Frontend build unavailable.")
        return FileResponse(index)
