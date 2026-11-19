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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // تنظیم خودکار ارتفاع کادر تایپ هنگام نوشتن چند خط
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

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

  const handleSend = async (e, overrideText = null) => {
    e?.preventDefault();
    const textToSend = (overrideText !== null ? overrideText : input).trim();
    if ((!textToSend && !attachedFile) || isLoading) return;

    const currentFile = attachedFile;

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: textToSend || `Attached file: ${currentFile.filename}`,
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
        body: JSON.stringify({ message: promptForAgent }),
      });
      if (!res.ok) throw new Error('Chat request failed');
      const data = await res.json();

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
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

  const handleReset = async () => {
    try {
      await fetch(`${API_URL}/reset`, { method: 'POST' });
      setMessages([]);
      setAttachedFile(null);
      setInput('');
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
      className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden select-none sm:select-auto"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* پوشش هنگام کشیدن فایل روی صفحه */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-md border-2 border-dashed border-violet-500/70 flex items-center justify-center">
          <div className="bg-zinc-900/90 border border-zinc-800 px-8 py-6 rounded-2xl text-center shadow-2xl">
            <FileText className="w-12 h-12 text-violet-400 mx-auto mb-3 animate-bounce" />
            <p className="text-lg font-medium text-zinc-100">Drop your file anywhere</p>
            <p className="text-xs text-zinc-400 mt-1">Supports PDF, TXT, MD, CSV, JSON</p>
          </div>
        </div>
      )}

      {/* سایدبار مدرن (آماده برای لیست گفتگوهای SQLite در مرحله بعد) */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-300 ease-in-out bg-zinc-900/60 border-r border-zinc-800/80 flex flex-col overflow-hidden shrink-0`}
      >
        <div className="p-3 flex items-center justify-between border-b border-zinc-800/60">
          <button
            onClick={handleReset}
            className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-sm font-medium text-zinc-100 border border-zinc-700/60 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-violet-400" />
            <span>New Chat</span>
          </button>
        </div>

        {/* جایگاه تاریخچه چت‌های SQLite */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Recent Sessions
          </p>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-800/50 text-zinc-300 text-xs border border-zinc-800">
            <MessageSquare className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">Current Active Session</span>
          </div>
          <p className="px-2 pt-3 text-[11px] text-zinc-600 leading-relaxed">
            SQLite persistent history will appear here in the next step.
          </p>
        </div>

        {/* فوتر سایدبار */}
        <div className="p-3 border-t border-zinc-800/60 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-xs font-bold shadow-md">
            AM
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-200 truncate">Amir Local Agent</p>
            <p className="text-[11px] text-zinc-500 truncate">macOS • Private & Offline</p>
          </div>
        </div>
      </aside>

      {/* بخش اصلی چت */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900/40">
        {/* هدر مینیمال و شیشه‌ای */}
        <header className="h-14 px-4 flex items-center justify-between border-b border-zinc-800/70 bg-zinc-950/70 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 transition cursor-pointer"
              title="Toggle sidebar"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-100">Amir AI</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                qwen2.5:7b
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/80 px-3 py-1.5 rounded-full border border-zinc-800/80">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Local Engine Ready</span>
          </div>
        </header>

        {/* ناحیه نمایش پیام‌ها یا صفحه خوش‌آمدگویی */}
        <main className="flex-1 overflow-y-auto px-4">
          {messages.length === 0 ? (
            /* صفحه شروع مدرن (Empty State) */
            <div className="h-full max-w-2xl mx-auto flex flex-col items-center justify-center text-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-violet-600/20 mb-5">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
                How can I help you today?
              </h2>
              <p className="text-sm text-zinc-400 mt-2 max-w-md">
                Ask questions, search your local files, or drop a PDF document to analyze it completely offline.
              </p>

              {/* کارت‌های پیشنهادی */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-8 text-left">
                {SUGGESTED_PROMPTS.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => setInput(item.prompt)}
                      className="p-4 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-violet-500/40 transition group cursor-pointer flex flex-col justify-between"
                    >
                      <div className="p-2 w-fit rounded-lg bg-zinc-800/80 group-hover:bg-violet-500/10 text-zinc-300 group-hover:text-violet-400 transition mb-3">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">{item.title}</p>
                        <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">
                          {item.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* لیست پیام‌های گفتگو */
            <div className="max-w-3xl mx-auto py-6 space-y-6">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const textDir = getTextDirection(msg.content);

                return (
                  <div
                    key={idx}
                    className={`flex gap-3.5 group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* آواتار */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${
                        isUser
                          ? 'bg-zinc-800 border border-zinc-700 text-zinc-200'
                          : 'bg-gradient-to-tr from-violet-600 to-indigo-500 text-white'
                      }`}
                    >
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* بدنه پیام */}
                    <div className={`flex flex-col max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}>
                      <div
                        dir={textDir}
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-2 text-xs bg-violet-500/10 text-violet-300 rounded-lg border border-violet-500/20"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{msg.file}</span>
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
                                    className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 overflow-x-auto text-xs font-mono text-zinc-200 my-2 text-left"
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

                      {/* دکمه کپی زیر پیام دستیار */}
                      {!isUser && (
                        <button
                          onClick={() => handleCopy(msg.content, idx)}
                          className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition px-1 cursor-pointer"
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

              {/* انیمیشن در حال پردازش */}
              {isLoading && (
                <div className="flex gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl px-4 py-3 flex items-center gap-2.5 text-zinc-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                    <span>Thinking & running tools...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* کادر ورودی شناور و مدرن */}
        <footer className="p-4 pt-2 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="bg-zinc-900/90 border border-zinc-800 focus-within:border-zinc-700 rounded-2xl p-2 shadow-xl transition">
              {/* نمایش فایل پیوست شده */}
              {attachedFile && (
                <div className="px-2 pt-1 pb-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20 rounded-xl">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="max-w-[200px] truncate">{attachedFile.filename}</span>
                    <button
                      onClick={() => setAttachedFile(null)}
                      className="hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
                  placeholder="Message Amir AI or drop a PDF..."
                  className={`flex-1 resize-none bg-transparent py-2.5 px-1 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none max-h-40 ${
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
            <p className="text-[11px] text-center text-zinc-600 mt-2">
              Running locally on your Mac • Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}