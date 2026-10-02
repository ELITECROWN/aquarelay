"""Set storage isolation before any test module imports the application."""
import os
from pathlib import Path
import tempfile

TEST_ROOT=Path(tempfile.mkdtemp(prefix="aquarelay-tests-",dir=Path(__file__).resolve().parents[1]))
os.environ["DATABASE_URL"]="sqlite:///"+str(TEST_ROOT/"test.sqlite").replace("\\","/")
os.environ["STORAGE_PATH"]=str(TEST_ROOT/"files")
os.environ["DEMO_MODE"]="true"
os.environ["EMBEDDED_WORKER"]="false"
os.environ["SESSION_SECRET"]="foundation-test-secret-at-least-32-characters"
