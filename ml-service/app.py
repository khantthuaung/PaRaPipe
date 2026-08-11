import os
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import fitz
import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from faster_whisper import WhisperModel

app = FastAPI(title="Notedly ML Processor")
model = None


def authorize(value: str | None):
    expected = os.getenv("ML_SERVICE_TOKEN")
    if expected and value != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def whisper_model():
    global model
    if model is None:
        model = WhisperModel(
            os.getenv("WHISPER_MODEL", "turbo"),
            device=os.getenv("WHISPER_DEVICE", "auto"),
            compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
        )
    return model


async def summarize(text: str) -> str:
    if not text.strip():
        return "No readable or spoken content was found."
    prompt = (
        "Turn this class material into accurate student notes. Use these headings: "
        "Overview, Key concepts, Definitions, Examples, Important formulas or dates, "
        "Assignments, Likely exam topics, and Review questions. Never invent facts.\n\n"
        + text[:120000]
    )
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            response = await client.post(
                f"{os.getenv('OLLAMA_URL', 'http://ollama:11434').rstrip('/')}/api/chat",
                json={"model": os.getenv("OLLAMA_MODEL", "qwen3:8b"), "stream": False,
                      "messages": [{"role": "user", "content": prompt}]},
            )
            response.raise_for_status()
            return response.json()["message"]["content"]
    except Exception:
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        return "## Overview\n\n" + " ".join(paragraphs)[:6000]


async def download_direct_media(url: str, path: Path):
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="Only HTTPS media URLs are supported")
    async with httpx.AsyncClient(follow_redirects=True, timeout=120) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if not (content_type.startswith("audio/") or content_type.startswith("video/")):
                raise HTTPException(status_code=422, detail="This is a webpage link, not a direct media file. Use a platform-approved connector.")
            with path.open("wb") as output:
                async for chunk in response.aiter_bytes():
                    output.write(chunk)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/process")
async def process(
    kind: str = Form(...),
    name: str = Form(...),
    url: str | None = Form(None),
    file: UploadFile | None = File(None),
    authorization: str | None = Header(None),
):
    authorize(authorization)
    suffix = Path(name).suffix or (".mp4" if kind == "link" else ".bin")
    with tempfile.TemporaryDirectory() as directory:
        source = Path(directory) / f"source{suffix}"
        if file:
            with source.open("wb") as output:
                while chunk := await file.read(1024 * 1024):
                    output.write(chunk)
        elif url:
            await download_direct_media(url, source)
        else:
            raise HTTPException(status_code=400, detail="A file or direct media URL is required")

        if kind == "pdf":
            document = fitz.open(source)
            transcript = "\n\n".join(page.get_text() for page in document)
        else:
            segments, _ = whisper_model().transcribe(str(source), vad_filter=True, beam_size=5)
            transcript = " ".join(segment.text.strip() for segment in segments).strip()
        return {"transcript": transcript, "summary": await summarize(transcript)}
