# 🤖 Amir AI — Local Full-Stack AI Agent

A privacy-first, locally hosted AI assistant built from scratch in Python and React. Powered by **Ollama (`qwen2.5:7b`)**, it features a custom ReAct-style tool-calling engine, a **FastAPI** backend, and a modern **React + Tailwind CSS** web interface with automatic RTL/LTR text alignment and PDF document analysis.

---

## ✨ Key Features

- **Custom Tool-Calling Framework (`my_ai.py`):**
  - Lightweight, zero-bloat ReAct agent loop with step limits (`max_steps`) to prevent infinite loops.
  - Automatic Python type-hint (`Annotated`, `get_origin`, `get_args`, `inspect`) to JSON Schema translation using `@agent.tool`.
- **Built-in Local Tools:**
  - `read_pdf`: Extracts and summarizes text from uploaded PDF documents.
  - `search_files`: Searches directories and subfolders for matching files on the local filesystem.
- **FastAPI Backend (`server.py`):**
  - Clean REST endpoints (`/chat`, `/upload`, `/reset`) with Pydantic request validation and CORS support.
- **Modern React UI (`frontend/`):**
  - Built with React, Vite, and Tailwind CSS.
  - Drag-and-drop & click-to-attach file uploads.
  - Smart automatic text direction detection (`RTL` for Persian/Arabic, `LTR` for English) per message bubble and input field.
  - Full Markdown rendering for structured responses and code blocks.

---

## 🏗️ Project Structure

```text
├── my_ai.py            # Core Agent & Tools schema introspection engine
├── server.py           # FastAPI application, endpoints & tool definitions
├── requirements.txt    # Python dependencies
├── uploads/            # Temporary storage for uploaded files (gitignored)
└── frontend/           # React + Vite + Tailwind CSS web application
    ├── src/
    │   ├── App.jsx     # Main chat UI & file upload logic
    │   └── index.css   # Tailwind CSS setup
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
git clone [https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git)
cd YOUR_REPO_NAME

# Create and activate a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
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