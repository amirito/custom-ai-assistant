import os
import shutil
from typing import Annotated, Any
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader

# ایمپورت کردن کلاس Agent از فایل قبلی خودت
from my_ai import Agent

app = FastAPI(title="Amir AI API")

# فعال‌سازی CORS برای اینکه React (روی پورت 5173) اجازه صحبت با FastAPI (روی پورت 8000) را داشته باشد
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ساخت نمونه ایجنت
agent = Agent(
    model="qwen2.5:7b",
    system_prompt=(
        "You are Amir AI, a helpful, intelligent local assistant. "
        "You can read uploaded PDF files and search files on the system when asked. "
        "Respond in the same language the user uses (e.g., Persian or English). "
        "For normal chat, answer directly without using tools."
    ),
)

# --- ثبت ابزارها روی ایجنت ---

@agent.tool
def read_pdf(
    file_path: Annotated[str, "The path to the PDF file"],
    max_pages: Annotated[int, "Maximum number of pages to read"] = 3,
) -> dict[str, Any]:
    """Extract and return text content from a PDF file."""
    expanded_path = os.path.expanduser(file_path)
    if not os.path.isfile(expanded_path):
        return {"error": f"PDF file not found at '{file_path}'."}

    reader = PdfReader(expanded_path)
    total_pages = len(reader.pages)
    pages_to_read = min(total_pages, max_pages)

    extracted_text: list[str] = []
    for i in range(pages_to_read):
        page_text = reader.pages[i].extract_text() or ""
        extracted_text.append(f"--- Page {i + 1} ---\n{page_text}")

    full_text = "\n\n".join(extracted_text)
    if len(full_text) > 6000:
        full_text = full_text[:6000] + "\n... [Content truncated due to length]"

    return {
        "total_pages": total_pages,
        "pages_read": pages_to_read,
        "content": full_text,
    }

@agent.tool
def search_files(
    directory: Annotated[str, "The folder path to search in (e.g., 'uploads' or '~/Desktop')"],
    keyword: Annotated[str, "Part of the filename or extension (e.g., '.pdf')"],
) -> dict[str, Any]:
    """Search for files matching a keyword inside a directory."""
    expanded_dir = os.path.expanduser(directory)
    if not os.path.exists(expanded_dir):
        return {"error": f"Directory '{directory}' does not exist."}

    matches: list[str] = []
    for root, _, files in os.walk(expanded_dir):
        for file in files:
            if keyword.lower() in file.lower():
                matches.append(os.path.join(root, file))
                if len(matches) >= 20:
                    return {"files": matches, "note": "Showing first 20 matches."}
    return {"files": matches}

# --- مدل‌های ورودی و مسیرهای API ---

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    reply = agent.chat(req.message)
    return {"reply": reply}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {
        "filename": file.filename,
        "file_path": file_path,
        "message": "File uploaded successfully"
    }

@app.post("/reset")
def reset_chat():
    agent.messages.clear()
    return {"status": "Conversation history cleared"}