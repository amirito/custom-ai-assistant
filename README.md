# 🤖 Amir AI — Local Full-Stack AI Agent

A privacy-first, locally hosted AI assistant built from scratch in Python and React. Powered by **Ollama (`qwen2.5:7b`)**, it features a custom ReAct-style tool-calling engine with real-time token streaming, persistent **SQLite** conversation memory, a **FastAPI** backend, and a responsive **React + Tailwind CSS** web interface with automatic RTL/LTR text alignment and PDF document analysis.

---

## ✨ Key Features

- **Custom Tool-Calling & Streaming Engine (`my_ai.py`):**
  - Lightweight, zero-bloat ReAct agent loop (`chat` & `chat_stream`) with step limits (`max_steps`) to prevent infinite loops.
  - Real-time Server-Sent Events (SSE) token-by-token streaming with live tool execution status updates.
  - Automatic Python type-hint (`Annotated`, `get_origin`, `get_args`, `inspect`) to JSON Schema translation using `@agent.tool`.
- **Persistent SQLite Memory (`database.py`):**
  - Automatically saves all chat sessions and message histories locally in SQLite (`chat_history.db`).
  - Supports switching between past sessions, restoring LLM conversation context, and deleting old chats from the sidebar.
- **Built-in Local Tools:**
  - `read_pdf`: Extracts and summarizes text from uploaded PDF documents.
  - `search_files`: Searches directories and subfolders for matching files on the local filesystem.
- **FastAPI Backend (`server.py`):**
  - Clean REST & SSE endpoints (`/chat`, `/chat/stream`, `/sessions`, `/upload`) with Pydantic request validation and CORS support.
- **Responsive React UI (`frontend/`):**
  - Mobile-first responsive layout with a collapsible desktop sidebar and slide-over mobile drawer.
  - Drag-and-drop & click-to-attach file uploads.
  - Smart automatic text direction detection (`RTL` for Persian/Arabic, `LTR` for English) per message bubble and input field.
  - Full Markdown rendering with custom code blocks and one-click copy.

---

## 🏗️ Project Structure

```text
├── my_ai.py            # Core Agent, streaming loop & tool schema introspection
├── database.py         # SQLite database initialization and CRUD helpers
├── server.py           # FastAPI application, SSE endpoints & tool definitions
├── requirements.txt    # Python dependencies
├── chat_history.db     # Local SQLite database (auto-generated, gitignored)
├── uploads/            # Temporary storage for uploaded files (gitignored)
└── frontend/           # React + Vite + Tailwind CSS web application
    ├── src/
    │   ├── App.jsx     # Main responsive chat UI, SSE stream reader & sidebar
    │   └── index.css   # Tailwind CSS & custom scrollbar setup
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites

1. **Python 3.10+**
2. **Node.js 18+** & `npm`
3. **[Ollama](https://ollama.com/)** installed and running locally with the `qwen2.5:7b` model:
   ```bash
   ollama pull qwen2.5:7b
   ```

---

### 1. Backend Setup (FastAPI)

Clone the repository and set up the Python environment:

```bash
git clone [https://github.com/amirito/custom-ai-assistant.git](https://github.com/amirito/custom-ai-assistant.git)
cd custom-ai-assistant

# Create and activate a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server (automatically initializes chat_history.db)
uvicorn server:app --reload --port 8000
```

The API will be available at `http://127.0.0.1:8000` (interactive Swagger docs at `http://127.0.0.1:8000/docs`).

---

### 2. Frontend Setup (React)

Open a new terminal window and start the React development server:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser to start chatting with **Amir AI**.

---

## 🛠️ Adding New Tools

You can easily extend the agent's capabilities in `server.py` by decorating any typed Python function with `@agent.tool`:

```python
from typing import Annotated, Any

@agent.tool
def get_weather(
    city: Annotated[str, "Name of the city to check weather for"]
) -> dict[str, Any]:
    """Fetch current weather information for a given city."""
    return {"city": city, "status": "Sunny, 22°C"}
```

The framework automatically inspects the function signature, generates the JSON schema, and exposes it to the LLM.