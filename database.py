import sqlite3
import uuid
from datetime import datetime
from typing import Any

DB_PATH = "chat_history.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # برای دسترسی به ستون‌ها با نام (شبیه دیکشنری)
    return conn

def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                file_name TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
            )
        """)

def create_session(first_message: str) -> str:
    session_id = str(uuid.uuid4())
    # انتخاب ۴۰ کاراکتر اول پیام کاربر به عنوان تیتر چت در سایدبار
    title = first_message.strip()[:40] + ("..." if len(first_message.strip()) > 40 else "")
    if not title:
        title = "New Conversation"
    now = datetime.utcnow().isoformat()

    with get_connection() as conn:
        conn.execute(
            "INSERT INTO sessions (id, title, created_at) VALUES (?, ?, ?)",
            (session_id, title, now),
        )
    return session_id

def save_message(session_id: str, role: str, content: str, file_name: str | None = None):
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO messages (session_id, role, content, file_name, created_at) VALUES (?, ?, ?, ?, ?)",
            (session_id, role, content, file_name, now),
        )

def get_all_sessions() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, title, created_at FROM sessions ORDER BY created_at DESC"
        ).fetchall()
        return [dict(row) for row in rows]

def get_session_messages(session_id: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT role, content, file_name FROM messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,),
        ).fetchall()
        return [dict(row) for row in rows]

def delete_session(session_id: str):
    with get_connection() as conn:
        conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))