from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import torch
from torchvision import transforms
import timm
import uvicorn

# --- Config ---
MODEL_PATH = "models/best_advanced.pth"
ARCH       = "efficientnetv2_s"
CLASS_NAMES = [
    "Canis", "Draconis", "Equus", "Feline",
    "Gekko", "Lupus",   "Mantis","Raptor",
    "Slime", "Vulpes"
]

# --- App & CORS ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # allow your tampermonkey script origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Device ---
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- Model Loading ---
model = timm.create_model(ARCH, pretrained=False, num_classes=len(CLASS_NAMES))
checkpoint = torch.load(MODEL_PATH, map_location=device)
# If you saved under key "model_state" adjust here, else it will load raw state_dict
state_dict = checkpoint.get("model_state", checkpoint)
model.load_state_dict(state_dict, strict=False)
model.to(device).eval()

# --- Preprocessing ---
preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485,0.456,0.406],
                         std =[0.229,0.224,0.225]),
])

# --- Inference endpoint ---
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Expects form-data with a 'file' field containing the image.
    Returns: { "predicted_class": "<one of CLASS_NAMES>" }
    """
    contents = await file.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")
    inp = preprocess(img).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(inp)
        pred = logits.argmax(dim=1).item()
        label = CLASS_NAMES[pred]

    return {"predicted_class": label}

# --- Run ---
if __name__ == "__main__":
    uvicorn.run("inference_api:app", host="0.0.0.0", port=8000, reload=True)
