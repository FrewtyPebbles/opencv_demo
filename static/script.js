const webcam = document.createElement('video');
webcam.autoplay = true;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const faces_canvas = document.getElementById('faces_canvas');
const faces_ctx = faces_canvas.getContext('2d');

const IMAGE_RES = 224

var RES_SCALE = {h:webcam.videoHeight / IMAGE_RES, w:webcam.videoWidth / IMAGE_RES}

async function startWebcam() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    webcam.srcObject = stream;

    // Wait for the video to load its metadata
    return new Promise((resolve) => {
        webcam.onloadedmetadata = () => {
            webcam.play();
            resolve();
        };
    });
}

const processFrames = async () => {
    const [tracking_url, analysis_url, track_and_analysis_url, landmarks_url] = ['/track', '/analysis', '/track_and_analysis', '/landmarks'];
    canvas.width = webcam.videoWidth;
    canvas.height = webcam.videoHeight;
    faces_canvas.width = webcam.videoWidth;
    faces_canvas.height = webcam.videoHeight;
    RES_SCALE = {h:webcam.videoHeight / IMAGE_RES, w:webcam.videoWidth / IMAGE_RES}

    if (canvas.width === 0 || canvas.height === 0) {
        console.error("Canvas dimensions are invalid");
        return;
    } else {
        console.log("VALID DIMS")
    }

    var tracking_data = []
    var tracking_ready = true;

    var landmark_data = []
    var landmark_ready = true;
    while (true) {
        // Draw the current frame from the webcam onto the canvas
        
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = IMAGE_RES;
        resizedCanvas.height = IMAGE_RES;
        const r_ctx = resizedCanvas.getContext('2d');
        r_ctx.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height)
        // Get the frame as a binary blob
        const frameBlob = await new Promise(resolve => resizedCanvas.toBlob(resolve, 'image/jpeg'));
        if (!frameBlob) {
            console.error("Failed to generate frame blob");
            continue; // Skip sending if no valid blob
        }

        const formData = new FormData();
        formData.append("file", frameBlob);

        if (tracking_ready) {
            tracking_ready = false;
            fetch(tracking_url, {
                method: 'POST', body: formData
            }).then(async (response) => {
                if (response.ok) {
                    tracking_data = await response.json()
                    tracking_ready = true;
                    draw_tracking_data(tracking_data, true);
                } else {
                    console.error(`Error: ${response.statusText}`);
                }
            })
        }

        if (landmark_ready) {
            landmark_ready = false;
            fetch(landmarks_url, {
                method: 'POST', body: formData
            }).then(async (response) => {
                if (response.ok) {
                    landmark_data = await response.json()
                    landmark_ready = true;
                    draw_meshes(landmark_data)
                } else {
                    console.error(`Error: ${response.statusText}`);
                }
            })

        }
        

        
        ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);
        draw_tracking_data(tracking_data);
        draw_meshes(landmark_data)
    }
};

function face_str(face) {
    return `${face.x} ${face.y} ${face.w} ${face.h}`
}

function show_face(bbox, prev_x, dims) {
    faces_ctx.font = "20px serif"
    faces_ctx.clearRect(prev_x, 0, dims.x, dims.y + 90)
    faces_ctx.drawImage(webcam, bbox.x*RES_SCALE.w, bbox.y*RES_SCALE.h, bbox.w*RES_SCALE.w, bbox.h*RES_SCALE.h, prev_x, 0, dims.x, dims.y);
}

function draw_tracking_data(face_data, update_faces = false) {
    let prev_x = 0
    let dims = {x:150, y:150}
    if (update_faces)
        faces_ctx.reset()
    for (const face of face_data) {
        ctx.strokeStyle = "#00ff1e"
        ctx.fillStyle = "#00ff1e"

        ctx.strokeRect(face.face.x*RES_SCALE.w, face.face.y*RES_SCALE.h, face.face.w*RES_SCALE.w, face.face.h*RES_SCALE.h);

        for (const eye of face.eyes) {
            ctx.strokeStyle = "#ff1100"
            ctx.strokeRect(eye.bbox.x*RES_SCALE.w, eye.bbox.y*RES_SCALE.h, eye.bbox.w*RES_SCALE.w, eye.bbox.h*RES_SCALE.h);
            for (const pupil of eye.pupil) {
                ctx.strokeStyle = "#ffffff"
                ctx.strokeRect(pupil.x*RES_SCALE.w-3, pupil.y*RES_SCALE.h-3, 3, 3);
            }
        }

        if (update_faces)
            show_face(face.face, prev_x, dims)
        prev_x += dims.x*RES_SCALE.w
    }
}

function lerp( a, b, alpha ) {
    return a + alpha * ( b - a )
}

const max = (objects, inf, attribute = (obj) => obj) => objects.reduce((acc, obj) => {
    return attribute(obj) > attribute(acc) ? obj : acc;
}, inf);

const min = (objects, inf, attribute = (obj) => obj) => objects.reduce((acc, obj) => {
    return attribute(obj) < attribute(acc) ? obj : acc;
}, inf);

function draw_meshes(meshes) {
    for (const mesh of meshes) {
        ctx.strokeStyle = "#00ff1e"
        
        let max_p = {...max(mesh, {z:-Infinity}, (p) => p.z)}
        let min_p = {...min(mesh, {z:Infinity}, (p) => p.z)}

        max_p.z -= min_p.z

        for (var p of mesh) {
            p.z -= min_p.z
            ctx.fillStyle = `rgb(${lerp(0,255,p.z/max_p.z)}, ${255-lerp(0,255,p.z/max_p.z)}, ${lerp(0,255,p.z/max_p.z)})`
            ctx.fillRect(p.x*RES_SCALE.w-1, p.y*RES_SCALE.h-1, 2, 2);
        }
    }
}

function draw_analysis_data(analysis_data, bbox) {
    const {age, dominant_gender, dominant_race, dominant_emotion} = analysis_data
    ctx.strokeStyle = "#00ff1e"
    ctx.fillStyle = "#00ff1e"

    ctx.fillText(`age ${age}`, bbox.x*RES_SCALE.w, bbox.y*RES_SCALE.h)
    ctx.fillText(`gender ${dominant_gender}`, bbox.x*RES_SCALE.w, bbox.y*RES_SCALE.h - 10)
    ctx.fillText(`race ${dominant_race}`, bbox.x*RES_SCALE.w, bbox.y*RES_SCALE.h - 20)
    ctx.fillText(`emotion ${dominant_emotion}`, bbox.x*RES_SCALE.w, bbox.y*RES_SCALE.h - 30)
}

// Utility function to load an image
const loadImage = (url) =>
    new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = url;
    });


    startWebcam().then(() => {
        console.log("Video dimensions:", webcam.videoWidth, webcam.videoHeight);
        canvas.width = webcam.videoWidth;
        canvas.height = webcam.videoHeight;
        faces_canvas.width = webcam.videoWidth;
        faces_canvas.height = webcam.videoHeight;
        RES_SCALE = {h:webcam.videoHeight / IMAGE_RES, w:webcam.videoWidth / IMAGE_RES}
    
        if (canvas.width === 0 || canvas.height === 0) {
            console.error("Canvas dimensions are invalid after video loaded");
            return;
        }
    
        processFrames();
    });