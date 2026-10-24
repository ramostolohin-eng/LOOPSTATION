"""Stem-separation server for LoopStation (runs Demucs on a computer you control).

    pip install -r requirements.txt
    LOOP_TOKEN=choose-a-secret uvicorn server:app --host 0.0.0.0 --port 8000

Endpoints (all but /health need header X-Token when LOOP_TOKEN is set):
    GET    /health
    POST   /jobs                    multipart: file, model (htdemucs_6s|htdemucs|htdemucs_ft), fmt (wav|mp3)
    GET    /jobs/{id}               {status: queued|running|done|error, stems: [...], error}
    GET    /jobs/{id}/stems/{file}  the separated stem
    DELETE /jobs/{id}
"""
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

JOBS_DIR = Path(os.environ.get("LOOP_JOBS_DIR", "./jobs")).resolve()
JOBS_DIR.mkdir(parents=True, exist_ok=True)
TOKEN = os.environ.get("LOOP_TOKEN", "")
MAX_MB = int(os.environ.get("LOOP_MAX_MB", "100"))
MODELS = {"htdemucs_6s", "htdemucs", "htdemucs_ft"}
STEM_RE = re.compile(r"^[A-Za-z0-9_\-]+\.(wav|mp3)$")

app = FastAPI(title="LoopStation separation server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def private_network_access(request, call_next):
    # The Android WebView page (https origin) calls this server on a private LAN address:
    # browsers may require this header on the CORS preflight ("Private Network Access").
    resp = await call_next(request)
    resp.headers["Access-Control-Allow-Private-Network"] = "true"
    return resp


JOBS: dict = {}
GPU_LOCK = threading.Semaphore(1)  # one separation at a time


def auth(x_token: str = Header(default="")):
    if TOKEN and x_token != TOKEN:
        raise HTTPException(401, "bad token")


def run_job(job_id: str, model: str, fmt: str):
    job = JOBS[job_id]
    jdir = JOBS_DIR / job_id
    with GPU_LOCK:
        job["status"] = "running"
        out = jdir / "out"
        cmd = [sys.executable, "-m", "demucs", "-n", model, "-o", str(out), str(job["input"])]
        if fmt == "mp3":
            cmd.append("--mp3")
        try:
            p = subprocess.run(cmd, capture_output=True, text=True)
        except Exception as e:  # noqa: BLE001
            job.update(status="error", error=str(e))
            return
        if p.returncode != 0:
            job.update(status="error", error=(p.stderr or p.stdout)[-600:])
            return
        files = sorted(out.glob(f"{model}/*/*.{fmt}"))
        if not files:
            job.update(status="error", error="no stems produced")
            return
        job["files"] = {f.name: f for f in files}
        job.update(status="done", stems=list(job["files"].keys()))


@app.get("/health")
def health():
    return {"ok": True, "time": time.time()}


@app.post("/jobs", dependencies=[Depends(auth)])
async def create_job(file: UploadFile = File(...), model: str = Form("htdemucs_6s"), fmt: str = Form("wav")):
    if model not in MODELS:
        raise HTTPException(400, "unknown model")
    if fmt not in {"wav", "mp3"}:
        raise HTTPException(400, "unknown format")
    job_id = uuid.uuid4().hex[:12]
    jdir = JOBS_DIR / job_id
    jdir.mkdir()
    ext = re.sub(r"[^A-Za-z0-9]", "", Path(file.filename or "x.mp3").suffix)[:5] or "mp3"
    inp = jdir / f"input.{ext}"
    size = 0
    with open(inp, "wb") as fh:
        while chunk := await file.read(1 << 20):
            size += len(chunk)
            if size > MAX_MB * (1 << 20):
                fh.close()
                shutil.rmtree(jdir, ignore_errors=True)
                raise HTTPException(413, f"file larger than {MAX_MB} MB")
            fh.write(chunk)
    JOBS[job_id] = {"status": "queued", "input": inp, "stems": [], "error": None, "files": {}}
    threading.Thread(target=run_job, args=(job_id, model, fmt), daemon=True).start()
    return {"job_id": job_id}


def get_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "unknown job")
    return job


@app.get("/jobs/{job_id}", dependencies=[Depends(auth)])
def job_status(job_id: str):
    j = get_job(job_id)
    return {"status": j["status"], "stems": j["stems"], "error": j["error"]}


@app.get("/jobs/{job_id}/stems/{name}", dependencies=[Depends(auth)])
def job_stem(job_id: str, name: str):
    j = get_job(job_id)
    if not STEM_RE.match(name) or name not in j["files"]:
        raise HTTPException(404, "unknown stem")
    return FileResponse(j["files"][name])


@app.delete("/jobs/{job_id}", dependencies=[Depends(auth)])
def delete_job(job_id: str):
    get_job(job_id)
    JOBS.pop(job_id, None)
    shutil.rmtree(JOBS_DIR / job_id, ignore_errors=True)
    return {"ok": True}
