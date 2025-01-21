# Use an official Miniconda base image
FROM continuumio/miniconda3

# Set the working directory
WORKDIR /app

# Copy the application and requirements
COPY app.py /app/app.py
COPY requirements.txt /app/requirements.txt
COPY /static /app/static

# Initialize Conda and create a new environment
RUN conda init bash && \
    bash -c "source ~/.bashrc && \
    conda create -n env python=3.12 -y && \
    conda activate env && \
    pip install --no-cache-dir -r requirements.txt"

# Install the OpenGL library
RUN apt-get update && apt-get install -y libgl1

ENV WORKERS=8 UVICORN_ARGS=""

# Expose the FastAPI default port
EXPOSE 8000

# Command to run the FastAPI server
CMD ["bash", "-c", "source ~/.bashrc && conda activate env && uvicorn app:app --host 0.0.0.0 --port 8000 --workers ${WORKERS} ${UVICORN_ARGS}"]
