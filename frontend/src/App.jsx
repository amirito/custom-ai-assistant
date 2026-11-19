import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Paperclip, Trash2, Bot, User, FileText, Loader2, X } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

// تشخیص هوشمند فارسی یا انگلیسی بودن متن برای تراز دقیق چپ یا راست
const getTextDirection = (text) => {
  const persianRegex = /[\u0600-\u06FF]/;
  return persianRegex.test(text) ? 'rtl' : 'ltr';
};

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am **Amir AI**. How can I help you today? You can upload a PDF file or ask me anything.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setAttachedFile({ filename: data.filename, file_path: data.file_path });
    } catch (err) {
      alert('Failed to upload file. Please make sure the FastAPI server is running.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if ((!input.trim() && !attachedFile) || isLoading) return;

    const userText = input.trim();
    const currentFile = attachedFile;

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userText || `Attached file: ${currentFile.filename}`,
        file: currentFile?.filename,
      },
    ]);

    setInput('');
    setAttachedFile(null);
    setIsLoading(true);

    const promptForAgent = currentFile
      ? `[Uploaded File Path: "${currentFile.file_path}"]\n${userText || 'Please read and summarize this file.'}`
      : userText;

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: promptForAgent }),
      });
      if (!res.ok) throw new Error('Chat request failed');
      const data = await res.json();

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ Connection error. Please check if the backend server is running.' },
      ]);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      await fetch(`${API_URL}/reset`, { method: 'POST' });
      setMessages([
        { role: 'assistant', content: 'Conversation history cleared. How can I help you?' },
      ]);
      setAttachedFile(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div
      dir="ltr"
      className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans text-left"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-indigo-950/80 backdrop-blur-sm border-2 border-dashed border-indigo-400 flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-16 h-16 text-indigo-400 mx-auto mb-3 animate-bounce" />
            <p className="text-xl font-semibold">Drop your file here to upload</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Amir AI</h1>
            <p className="text-xs text-slate-400">Powered by Qwen 2.5 & Custom Tools</p>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:text-red-400 bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition cursor-pointer"
          title="Start a new chat"
        >
          <Trash2 className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const textDir = getTextDirection(msg.content);

            return (
              <div
                key={idx}
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-1 ${
                    isUser ? 'bg-emerald-600' : 'bg-indigo-600'
                  }`}
                >
                  {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>

                {/* Message Bubble */}
                <div
                  dir={textDir}
                  className={`max-w-[80%] rounded-2xl px-4 py-3 leading-relaxed shadow-md ${
                    textDir === 'rtl' ? 'text-right' : 'text-left'
                  } ${
                    isUser
                      ? 'bg-emerald-600/20 border border-emerald-500/30 text-slate-100'
                      : 'bg-slate-900 border border-slate-800 text-slate-200'
                  }`}
                >
                  {msg.file && (
                    <div
                      dir="ltr"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-2 text-xs bg-slate-800 text-indigo-300 rounded-lg border border-slate-700"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{msg.file}</span>
                    </div>
                  )}
                  <div className="space-y-2 text-sm break-words">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Thinking / Tool Execution Indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Thinking and checking tools...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Footer */}
      <footer className="p-4 bg-slate-900/80 border-t border-slate-800">
        <div className="max-w-3xl mx-auto">
          {attachedFile && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-2 text-xs bg-indigo-950/70 text-indigo-300 border border-indigo-500/30 rounded-lg">
              <FileText className="w-4 h-4" />
              <span>{attachedFile.filename}</span>
              <button
                onClick={() => setAttachedFile(null)}
                className="hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              className="hidden"
              accept=".pdf,.txt,.md,.csv,.json"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isLoading}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition disabled:opacity-50 cursor-pointer"
              title="Attach file"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              ) : (
                <Paperclip className="w-5 h-5" />
              )}
            </button>

            <textarea
              dir={input ? getTextDirection(input) : 'ltr'}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message or drop a PDF file here..."
              className={`flex-1 resize-none rounded-xl bg-slate-800/90 border border-slate-700 px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition max-h-36 ${
                input && getTextDirection(input) === 'rtl' ? 'text-right' : 'text-left'
              }`}
            />

            <button
              type="submit"
              disabled={(!input.trim() && !attachedFile) || isLoading}
              className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition disabled:opacity-40 cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}