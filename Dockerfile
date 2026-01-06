# Use a lightweight Python base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for OpenGL / Mediapipe
RUN apt-get update && apt-get install -y libgl1 git curl && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y libglib2.0-0t64 && rm -rf /var/lib/apt/lists/*


# Install uv (Python version manager)
RUN pip install uv

# Copy application and requirements
COPY app.py /app/app.py
COPY pyproject.toml /app/pyproject.toml
COPY /static /app/static

# Install Python dependencies inside uv environment
RUN uv lock
RUN uv sync

# Environment variables for uvicorn
ENV WORKERS=8
ENV UVICORN_ARGS=""

# Expose FastAPI default port
EXPOSE 8000

# Use uv run to execute uvicorn, respecting WORKERS and UVICORN_ARGS
CMD ["bash", "-c", "uv run uvicorn app:app --host 0.0.0.0 --port 8000 --workers $WORKERS $UVICORN_ARGS"]
