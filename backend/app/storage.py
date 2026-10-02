"""Storage boundary for persistent private originals and sanitised public derivatives."""
import io
import os
import time
import re
from pathlib import Path
from fractions import Fraction
import av
from fastapi import HTTPException

class LocalStorage:
    def __init__(self,root=None):
        self.root=Path(root or os.getenv("STORAGE_PATH","./data/files")).resolve()

    def save(self,evidence_id,original,derivative,extension):
        original_path=self.root/"private"/(evidence_id+".bin")
        public_path=self.root/"public"/(evidence_id+extension)
        original_path.parent.mkdir(parents=True,exist_ok=True)
        public_path.parent.mkdir(parents=True,exist_ok=True)
        original_path.write_bytes(original)
        public_path.write_bytes(derivative)
        return str(original_path),str(public_path)

    def delete(self,evidence_id):
        if not re.fullmatch(r"[a-zA-Z0-9-]{1,80}",evidence_id):
            raise ValueError("Invalid storage identity")
        candidates=[self.root/"private"/(evidence_id+".bin"),self.root/"public"/(evidence_id+".jpg"),self.root/"public"/(evidence_id+".mp4")]
        for path in candidates:
            if not path.resolve().is_relative_to(self.root):
                raise ValueError("Storage deletion escaped its root")
        for path in candidates: path.unlink(missing_ok=True)

storage=LocalStorage()

def sanitise_video(content):
    if len(content)<12 or content[4:8]!=b"ftyp":
        raise HTTPException(422,"Evidence must be a valid MP4 container.")
    output_bytes=io.BytesIO()
    started=time.monotonic()
    frames=0
    try:
        with av.open(io.BytesIO(content),format="mp4",options={"protocol_whitelist":"file,pipe"}) as source:
            if len(source.streams.video)!=1:
                raise HTTPException(422,"MP4 evidence must contain exactly one video stream.")
            stream=source.streams.video[0]
            duration=float(stream.duration*stream.time_base) if stream.duration else source.duration/av.time_base if source.duration else None
            if duration and duration>60.05:
                raise HTTPException(413,"Videos may be at most 60 seconds.")
            if stream.width*stream.height>8_300_000 or min(stream.width,stream.height)<=0:
                raise HTTPException(413,"Video exceeds the 4K frame-size limit.")
            rate=stream.average_rate or Fraction(30,1)
            if not 1<=float(rate)<=60:
                raise HTTPException(413,"Supported video frame rates are 1–60 FPS.")
            scale=min(1280/stream.width,720/stream.height,1)
            width=max(2,int(stream.width*scale)//2*2)
            height=max(2,int(stream.height*scale)//2*2)
            # In-memory MP4s are seekable but have no filename to reopen for faststart.
            with av.open(output_bytes,mode="w",format="mp4") as destination:
                encoded=destination.add_stream("libx264",rate=rate)
                encoded.width=width; encoded.height=height; encoded.pix_fmt="yuv420p"
                encoded.bit_rate=1_000_000
                encoded.options={"preset":"ultrafast","crf":"28"}
                for frame in source.decode(video=0):
                    frames+=1
                    if frames>3600 or frame.time and frame.time>60.05:
                        raise HTTPException(413,"Video exceeds the 60-second or 3,600-frame limit.")
                    if time.monotonic()-started>45:
                        raise HTTPException(422,"Video processing exceeded the time limit; try a shorter clip.")
                    clean=frame.reformat(width=width,height=height,format="yuv420p")
                    clean.pts=None
                    for packet in encoded.encode(clean): destination.mux(packet)
                if not frames:
                    raise HTTPException(422,"Video contains no decodable frames.")
                for packet in encoded.encode(): destination.mux(packet)
        result=output_bytes.getvalue()
        if len(result)>20*1024*1024:
            raise HTTPException(413,"Public video derivative exceeds 20 MB.")
        return result
    except HTTPException:
        raise
    except (av.error.FFmpegError,ValueError,OverflowError,OSError):
        raise HTTPException(422,"Invalid or unsupported MP4 video. Upload a short H.264 MP4 clip.")
