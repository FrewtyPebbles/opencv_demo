from typing import AsyncGenerator
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import os
import mediapipe as mp

faceCascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
if faceCascade.empty():
    print("Error: Failed to load face cascade classifier.")

eyeCascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye_tree_eyeglasses.xml')
if eyeCascade.empty():
    print("Error: Failed to load eye cascade classifier.")

face_mesh = mp.solutions.face_mesh.FaceMesh(max_num_faces=3, refine_landmarks=True, min_detection_confidence=0.7, min_tracking_confidence=0.9)

async def lifespan(app: FastAPI) -> AsyncGenerator:
    # Code to run during app startup (before the app is fully started)
    print("App is starting up...")
    yield  # This will allow FastAPI to start the app
    # Code to run during app shutdown
    face_mesh.close()

app = FastAPI(lifespan=lifespan)

# CORS configuration
app.add_middleware(
    CORSMiddleware
)

# Serve static files like CSS or JavaScript
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve the HTML file
@app.get("/")
async def index():
    return FileResponse("static/index.html")

@app.post('/track')
async def track(file: UploadFile = File(...)):
    try:
        # Read the file data as a binary stream
        file_content = await file.read()
        
        # Convert the binary stream to a numpy array
        nparr = np.frombuffer(file_content, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise ValueError("Frame decoding failed. Invalid data format.")

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = faceCascade.detectMultiScale(gray, 1.3, 5)

        response = []

        for x,y,w,h in faces:
            # Get the face bounding box

            # Crop the face
            cropped_face_gray = gray[y:y+h, x:x+w]

            eyes = eyeCascade.detectMultiScale(cropped_face_gray)

            face = {'x':int(x), 'y':int(y), 'w':int(w), 'h':int(h)}
            eyes_list = []
            for ex,ey,ew,eh in eyes:


                eye_gray = cropped_face_gray[ey:ey+eh, ex:ex+ew]

                _, thresh = cv2.threshold(eye_gray, 70, 255, cv2.THRESH_BINARY_INV)

                # The contour arround the pupil since it was thresholded out
                contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
                #the largest area contours first
                contours = sorted(contours, key=lambda c: cv2.contourArea(c), reverse=True)

                pupil = []

                if contours:
                    (pupil_x, pupil_y), radius = cv2.minEnclosingCircle(contours[0])

                    pupil = [{'x':int(x+ex+pupil_x), 'y':int(y+ey+pupil_y)}]

                eyes_list.append({
                    'bbox':{'x':int(x+ex), 'y':int(y+ey), 'w':int(ew), 'h':int(eh)},
                    'pupil':pupil
                })



            response.append({
                'face':face,
                'eyes':eyes_list[::2]
            })

        return response

    except Exception as e:
        print(f"Error processing video frame: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing video frame: {e}")

@app.post('/landmarks')
async def landmarks(file: UploadFile = File(...)):
    
    # Read the file data as a binary stream
    file_content = await file.read()
    
    # Convert the binary stream to a numpy array
    nparr = np.frombuffer(file_content, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        raise ValueError("Frame decoding failed. Invalid data format.")

    fm_faces = face_mesh.process(frame)
    meshes = []
    if fm_faces.multi_face_landmarks:
        
        for fm_face in fm_faces.multi_face_landmarks:
            meshes.append([{'x': int(landmark.x*frame.shape[1]), 'y': int(landmark.y*frame.shape[0]), 'z': int(landmark.z*frame.shape[0])} for landmark in fm_face.landmark])

    return meshes

if __name__ == "__main__":
    # Ensure the static folder exists
    os.makedirs("static", exist_ok=True)
    
    # Run FastAPI server with uvicorn (command below starts it)
    # uvicorn <filename>:app --reload
