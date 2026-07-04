"""Vercel serverless entrypoint — imports the FastAPI app from backend/."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app  # noqa: E402,F401
