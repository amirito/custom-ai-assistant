import os
import shutil
from typing import Annotated, Any
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
import json
from fastapi.responses import StreamingResponse

from my_ai import Agent
import database as db

app = FastAPI(title="Amir AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ساخت جداول دیتابیس در لحظه شروع
db.init_db()

agent = Agent(
    model="qwen2.5:7b",
    system_prompt=(
        "You are Amir AI, a helpful and honest local assistant. "
        "If you do not have accurate knowledge about a specific cultural topic, recipe, or fact, "
        "honestly admit that you don't know instead of guessing or making up information. "
        "Use tools only when the user asks to read PDFs or search files."
    ),
)

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
        full_text = full_text[:6000] + "\n... [Text truncated due to length]"

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
    session_id: str | None = None
    display_message: str | None = None
    file_name: str | None = None

@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    session_id = req.session_id
    user_display = req.display_message or req.message

    # اگر چت جدید است، یک سشن در SQLite می‌سازیم
    if not session_id:
        session_id = db.create_session(user_display)
        agent.messages.clear()
    else:
        # بازیابی تاریخچه پیام‌های قبلی همین چت از دیتابیس برای حفظ کانتکست مدل
        past_messages = db.get_session_messages(session_id)
        agent.messages = [
            {"role": m["role"], "content": m["content"]} for m in past_messages
        ]

    # ذخیره پیام کاربر در دیتابیس
    db.save_message(session_id, "user", user_display, req.file_name)

    # دریافت پاسخ از ایجنت
    reply = agent.chat(req.message)

    # ذخیره پاسخ مدل در دیتابیس
    db.save_message(session_id, "assistant", reply)

    return {"reply": reply, "session_id": session_id}

@app.post("/chat/stream")
def chat_stream_endpoint(req: ChatRequest):
    session_id = req.session_id
    user_display = req.display_message or req.message

    if not session_id:
        session_id = db.create_session(user_display)
        agent.messages.clear()
    else:
        past_messages = db.get_session_messages(session_id)
        agent.messages = [
            {"role": m["role"], "content": m["content"]} for m in past_messages
        ]

    db.save_message(session_id, "user", user_display, req.file_name)

    def event_generator():
        # ارسال شناسه سشن در همان لحظه اول به فرانت‌اند
        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

        full_reply = ""
        try:
            for event in agent.chat_stream(req.message):
                if event["type"] == "token":
                    full_reply += event["content"]
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            err_msg = f"\n\n⚠️ Error: {str(e)}"
            full_reply += err_msg
            yield f"data: {json.dumps({'type': 'token', 'content': err_msg})}\n\n"

        # ذخیره کل پاسخ نهایی در SQLite پس از اتمام استریم
        if full_reply:
            db.save_message(session_id, "assistant", full_reply)

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/sessions")
def list_sessions():
    return {"sessions": db.get_all_sessions()}

@app.get("/sessions/{session_id}")
def get_session(session_id: str):
    messages = db.get_session_messages(session_id)
    return {"messages": messages}

@app.delete("/sessions/{session_id}")
def remove_session(session_id: str):
    db.delete_session(session_id)
    return {"status": "deleted"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {
        "filename": file.filename,
        "file_path": file_path,
        "message": "File uploaded successfully",
    }