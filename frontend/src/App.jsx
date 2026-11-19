import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Paperclip,
  Plus,
  Bot,
  User,
  FileText,
  Loader2,
  X,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Copy,
  Check,
  FolderSearch,
  FileUp,
  MessageSquare,
  Trash2,
} from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

const getTextDirection = (text) => {
  const persianRegex = /[\u0600-\u06FF]/;
  return persianRegex.test(text) ? 'rtl' : 'ltr';
};

const SUGGESTED_PROMPTS = [
  {
    icon: FileUp,
    title: 'Summarize a PDF',
    subtitle: 'Upload a document and extract key insights',
    prompt: 'Please summarize the main points of the attached PDF document.',
  },
  {
    icon: FolderSearch,
    title: 'Search local files',
    subtitle: 'Find PDFs or documents on Desktop',
    prompt: 'Search my ~/Desktop folder for any PDF files.',
  },
  {
    icon: Sparkles,
    title: 'Explain a concept',
    subtitle: 'Get a clear, structured breakdown',
    prompt: 'Explain how ReAct AI agents work in simple terms.',
  },
];

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // در دسکتاپ پیش‌فرض باز و در موبایل پیش‌فرض بسته است
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const loadSession = async (sessionId) => {
    if (isLoading) return;
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(sessionId);
        setMessages(
          data.messages.map((m) => ({
            role: m.role,
            content: m.content,
            file: m.file_name,
          }))
        );
        setAttachedFile(null);
        closeSidebarOnMobile();
      }
    } catch (err) {
      console.error('Failed to load session messages:', err);
    }
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await fetch(`${API_URL}/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        startNewChat();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setAttachedFile(null);
    setInput('');
    closeSidebarOnMobile();
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

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
      alert('Failed to upload file. Make sure the FastAPI server is running.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const textToSend = input.trim();
    if ((!textToSend && !attachedFile) || isLoading) return;

    const currentFile = attachedFile;
    const displayContent = textToSend || `Attached file: ${currentFile.filename}`;

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: displayContent,
        file: currentFile?.filename,
      },
    ]);

    setInput('');
    setAttachedFile(null);
    setIsLoading(true);

    const promptForAgent = currentFile
      ? `[Uploaded File Path: "${currentFile.file_path}"]\n${textToSend || 'Please read and summarize this file.'}`
      : textToSend;

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptForAgent,
          session_id: currentSessionId,
          display_message: displayContent,
          file_name: currentFile?.filename || null,
        }),
      });
      if (!res.ok) throw new Error('Chat request failed');
      const data = await res.json();

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);

      if (!currentSessionId && data.session_id) {
        setCurrentSessionId(data.session_id);
        fetchSessions();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ Connection error. Please check if the FastAPI backend is running.',
        },
      ]);
      console.error(err);
    } finally {
      setIsLoading(false);
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
      className="flex h-[100dvh] bg-zinc-950 text-zinc-100 font-sans overflow-hidden relative"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* پوشش Drag & Drop */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-md border-2 border-dashed border-violet-500/70 flex items-center justify-center p-4">
          <div className="bg-zinc-900/90 border border-zinc-800 px-8 py-6 rounded-2xl text-center shadow-2xl">
            <FileText className="w-12 h-12 text-violet-400 mx-auto mb-3 animate-bounce" />
            <p className="text-lg font-medium text-zinc-100">Drop your file anywhere</p>
            <p className="text-xs text-zinc-400 mt-1">Supports PDF, TXT, MD, CSV, JSON</p>
          </div>
        </div>
      )}

      {/* پس‌زمینه تیره پشت سایدبار فقط در حالت موبایل */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden"
        />
      )}

      {/* سایدبار ریسپانسیو (Drawer در موبایل / Fixed Panel در دسکتاپ) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 bg-zinc-900 md:bg-zinc-900/60 border-r border-zinc-800/80 flex flex-col overflow-hidden transition-all duration-300 ease-in-out shrink-0 ${
          sidebarOpen
            ? 'w-72 md:w-64 translate-x-0'
            : 'w-72 md:w-0 -translate-x-full md:translate-x-0 border-r-0'
        }`}
      >
        <div className="p-3 flex items-center gap-2 border-b border-zinc-800/60">
          <button
            onClick={startNewChat}
            className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-sm font-medium text-zinc-100 border border-zinc-700/60 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-violet-400" />
            <span>New Chat</span>
          </button>

          {/* دکمه بستن سایدبار در موبایل */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 md:hidden cursor-pointer"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* لیست تاریخچه چت‌ها */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Recent Sessions
          </p>

          {sessions.length === 0 ? (
            <p className="px-2 pt-2 text-xs text-zinc-600">
              No saved chats yet. Start a conversation!
            </p>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              const titleDir = getTextDirection(session.title);
              return (
                <div
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs cursor-pointer transition ${
                    isActive
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/70'
                      : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-violet-400' : 'text-zinc-500'
                      }`}
                    />
                    <span dir={titleDir} className="truncate">
                      {session.title}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 rounded transition cursor-pointer shrink-0"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* فوتر سایدبار */}
        <div className="p-3 border-t border-zinc-800/60 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-xs font-bold shadow-md shrink-0">
            AM
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-200 truncate">Amir Local Agent</p>
            <p className="text-[11px] text-zinc-500 truncate">SQLite Memory Enabled</p>
          </div>
        </div>
      </aside>

      {/* بخش اصلی چت */}
      <div className="flex-1 flex flex-col min-w-0 w-full bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900/40">
        {/* هدر ریسپانسیو */}
        <header className="h-14 px-3 sm:px-4 flex items-center justify-between border-b border-zinc-800/70 bg-zinc-950/70 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 transition cursor-pointer shrink-0"
              title="Toggle sidebar"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm text-zinc-100 whitespace-nowrap">Amir AI</span>
              <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 truncate">
                qwen2.5:7b
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/80 px-2.5 sm:px-3 py-1.5 rounded-full border border-zinc-800/80 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Local Engine Ready</span>
            <span className="sm:hidden text-[11px]">Ready</span>
          </div>
        </header>

        {/* ناحیه نمایش پیام‌ها یا صفحه شروع */}
        <main className="flex-1 overflow-y-auto px-3 sm:px-4">
          {messages.length === 0 ? (
            <div className="min-h-full max-w-2xl mx-auto flex flex-col items-center justify-center text-center py-6 sm:py-8">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-violet-600/20 mb-4 sm:mb-5">
                <Bot className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 px-2">
                How can I help you today?
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-2 max-w-md px-2">
                Ask questions, search your local files, or drop a PDF document to analyze it completely offline.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 w-full mt-6 sm:mt-8 text-left">
                {SUGGESTED_PROMPTS.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => setInput(item.prompt)}
                      className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-violet-500/40 transition group cursor-pointer flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0"
                    >
                      <div className="p-2 w-fit rounded-lg bg-zinc-800/80 group-hover:bg-violet-500/10 text-zinc-300 group-hover:text-violet-400 transition sm:mb-3 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-200">{item.title}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5 sm:mt-1 line-clamp-2">
                          {item.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto py-4 sm:py-6 space-y-5 sm:space-y-6">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const textDir = getTextDirection(msg.content);

                return (
                  <div
                    key={idx}
                    className={`flex gap-2.5 sm:gap-3.5 group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${
                        isUser
                          ? 'bg-zinc-800 border border-zinc-700 text-zinc-200'
                          : 'bg-gradient-to-tr from-violet-600 to-indigo-500 text-white'
                      }`}
                    >
                      {isUser ? <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    </div>

                    <div className={`flex flex-col max-w-[85%] sm:max-w-[82%] min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
                      <div
                        dir={textDir}
                        className={`w-full rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm leading-relaxed overflow-hidden ${
                          textDir === 'rtl' ? 'text-right' : 'text-left'
                        } ${
                          isUser
                            ? 'bg-zinc-800/90 text-zinc-100 border border-zinc-700/70'
                            : 'bg-zinc-900/70 text-zinc-200 border border-zinc-800/80'
                        }`}
                      >
                        {msg.file && (
                          <div
                            dir="ltr"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-2 text-xs bg-violet-500/10 text-violet-300 rounded-lg border border-violet-500/20 max-w-full"
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{msg.file}</span>
                          </div>
                        )}

                        <div className="space-y-2.5 break-words">
                          <ReactMarkdown
                            components={{
                              code({ inline, children, ...props }) {
                                return inline ? (
                                  <code
                                    dir="ltr"
                                    className="px-1.5 py-0.5 rounded bg-zinc-800 text-violet-300 font-mono text-xs"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                ) : (
                                  <pre
                                    dir="ltr"
                                    className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 overflow-x-auto text-xs font-mono text-zinc-200 my-2 text-left"
                                  >
                                    <code {...props}>{children}</code>
                                  </pre>
                                );
                              },
                              ul: ({ children }) => (
                                <ul className="list-disc list-inside space-y-1">{children}</ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-inside space-y-1">{children}</ol>
                              ),
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>

                      {!isUser && (
                        <button
                          onClick={() => handleCopy(msg.content, idx)}
                          className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition px-1 cursor-pointer"
                        >
                          {copiedIdx === idx ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-2.5 sm:gap-3.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center gap-2.5 text-zinc-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                    <span>Thinking & running tools...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* فوتر ورودی */}
        <footer className="p-2.5 sm:p-4 pt-2 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="bg-zinc-900/90 border border-zinc-800 focus-within:border-zinc-700 rounded-2xl p-1.5 sm:p-2 shadow-xl transition">
              {attachedFile && (
                <div className="px-2 pt-1 pb-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20 rounded-xl max-w-full">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="max-w-[180px] sm:max-w-[240px] truncate">{attachedFile.filename}</span>
                    <button
                      onClick={() => setAttachedFile(null)}
                      className="hover:text-white cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSend} className="flex items-end gap-1.5 sm:gap-2">
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
                  className="p-2.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition disabled:opacity-50 cursor-pointer shrink-0"
                  title="Attach file"
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                  ) : (
                    <Paperclip className="w-5 h-5" />
                  )}
                </button>

                <textarea
                  ref={textareaRef}
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
                  placeholder="Message Amir AI..."
                  className={`flex-1 min-w-0 resize-none bg-transparent py-2.5 px-1 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none max-h-40 ${
                    input && getTextDirection(input) === 'rtl' ? 'text-right' : 'text-left'
                  }`}
                />

                <button
                  type="submit"
                  disabled={(!input.trim() && !attachedFile) || isLoading}
                  className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/20 transition disabled:opacity-30 disabled:hover:bg-violet-600 cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
            <p className="hidden sm:block text-[11px] text-center text-zinc-600 mt-2">
              Running locally on your Mac • Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}