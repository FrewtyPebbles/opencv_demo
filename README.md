# OpenCV Demo

This web demo showcases a pytorch neural network I made that gauges emotions from photos of faces.

The web demo reads images from the webcam and sends them to a fastapi server that responds with any detected faces in the photo, eye/face tracking information, and what their predicted emotion is.

The demo uses the convolutional neural network I made in [this repo](https://github.com/FrewtyPebbles/Emotion-Recognition-AI).

## How To Run

To run, install the dependencies in the pyproject.toml:

```
pip install .
```

Start the server with uvicorn:

```
uvicorn app:app --reload
```

Then go to [http://127.0.0.1:8000/](http://127.0.0.1:8000/) and allow the site to use your webcamera.

---

Alternatively you can build the docker image and run it with:

```
docker run -p 8000:8000 <image name>
```