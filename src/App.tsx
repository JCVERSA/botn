import { useState, useEffect, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bot,
  Terminal,
  Settings,
  Download,
  Code2,
  Send,
  Zap,
  RefreshCw,
  Sparkles,
  Save,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Globe,
  Check,
  Play,
  Mic,
  Search,
  BarChart3,
  X,
  BookOpen,
  HelpCircle,
  Copy
} from "lucide-react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from "recharts";

import { BotConfig, BotCommand, ChatMessage, ConnectionStatus } from "./lib/types";
import { formatMessageLine, parseUsageAndParams } from "./lib/format";

export default function App() {
  // Tab states
  const [activeTab, setActiveTab] = useState<"control" | "commands" | "logs" | "export" | "analytics" | "documentation">("control");

  // Bot states fetched from server
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [config, setConfig] = useState<BotConfig>({
    botName: "Nebula Bot",
    prefix: ".",
    botImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
    ownerNumber: "",
    newsletterUrl: "https://whatsapp.com/channel/0029VaNebulaChannel",
    newsletterName: "Nebula Bot Official News",
  });

  // Analytics states
  const [analyticsStats, setAnalyticsStats] = useState<Record<string, number>>({
    menu: 24,
    ai: 18,
    image: 14,
    ping: 9,
    joke: 7,
    quote: 5,
    owner: 3
  });

  // Documentation Tab states
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [docSelectedCategory, setDocSelectedCategory] = useState("All");
  const [copiedCommandName, setCopiedCommandName] = useState<string | null>(null);

  // Audio Transcription states
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Voice Conversation states
  const [voiceInput, setVoiceInput] = useState("");
  const [voiceReplyText, setVoiceReplyText] = useState("");
  const [isVoiceResponding, setIsVoiceResponding] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const audioTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Editor states
  const [selectedCommand, setSelectedCommand] = useState<BotCommand | null>(null);
  const [commandCode, setCommandCode] = useState<string>("");
  const [isSavingCode, setIsSavingCode] = useState(false);

  // AI Builder states
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiCmdName, setAiCmdName] = useState("");
  const [aiCmdCategory, setAiCmdCategory] = useState("Utility");
  const [aiCmdDesc, setAiCmdDesc] = useState("");
  const [isGeneratingCommand, setIsGeneratingCommand] = useState(false);
  const [aiGenMessage, setAiGenMessage] = useState("");

  // Simulator states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "bot",
      senderName: "Nebula Bot",
      text: "👋 Welcome to the *Nebula Bot* Control Simulator!\n\nI am fully active. Try typing `.menu` or `.ping` below to test my command routing live in your browser!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Configuration form inputs
  const [formConfig, setFormConfig] = useState<BotConfig>({ ...config });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Fetch status, logs, and configs on mount and poll
  useEffect(() => {
    fetchConfig();
    fetchCommands();
    fetchStatus();
    fetchAnalytics();

    const interval = setInterval(() => {
      fetchStatus();
      fetchAnalytics();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Scroll simulator chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/bot/analytics");
      const data = await res.json();
      if (data.stats) {
        setAnalyticsStats(data.stats);
      }
    } catch (e) {}
  };

  // Helper to convert Blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Start recording for Audio Transcription
  const startRecording = async () => {
    setTranscriptionText("");
    setRecordingSeconds(0);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setIsTranscribing(true);
        try {
          const base64Audio = await blobToBase64(audioBlob);
          const response = await fetch("/api/gemini/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64Audio, mimeType: "audio/webm" }),
          });
          const result = await response.json();
          if (result.transcript) {
            setTranscriptionText(result.transcript);
          } else if (result.error) {
            setTranscriptionText(`⚠️ Error: ${result.error}`);
          } else {
            setTranscriptionText("⚠️ Failed to transcribe audio content.");
          }
        } catch (err: any) {
          setTranscriptionText(`❌ Network/Server Error: ${err.message || err}`);
        } finally {
          setIsTranscribing(false);
        }

        // Close stream tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      audioTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Stop recording for Audio Transcription
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (audioTimerRef.current) {
        clearInterval(audioTimerRef.current);
        audioTimerRef.current = null;
      }
    }
  };

  // Start voice conversation recording (or just use voice prompt)
  const handleVoiceCallConvo = async (textPrompt: string) => {
    if (!textPrompt.trim()) return;
    setIsVoiceResponding(true);
    setVoiceReplyText("");
    setIsPlayingVoice(false);

    try {
      const res = await fetch("/api/gemini/voice-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textPrompt }),
      });
      const data = await res.json();
      if (data.text) {
        setVoiceReplyText(data.text);
        if (data.audioBase64) {
          const rawAudioUrl = `data:audio/mp3;base64,${data.audioBase64}`;
          
          // Play automatically
          setTimeout(() => {
            if (audioPlayerRef.current) {
              audioPlayerRef.current.src = rawAudioUrl;
              audioPlayerRef.current.play()
                .then(() => setIsPlayingVoice(true))
                .catch(() => {});
            }
          }, 200);
        }
      } else if (data.error) {
        setVoiceReplyText(`⚠️ Voice engine error: ${data.error}`);
      }
    } catch (err: any) {
      setVoiceReplyText(`❌ Failed to connect to Voice Engine: ${err.message || err}`);
    } finally {
      setIsVoiceResponding(false);
    }
  };

  // Record mic audio to use as input for the voice conversation
  const startVoiceRecording = async () => {
    setVoiceInput("");
    setRecordingSeconds(0);
    voiceChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      voiceRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(voiceChunksRef.current, { type: "audio/webm" });
        setIsTranscribing(true);
        try {
          const base64Audio = await blobToBase64(audioBlob);
          const response = await fetch("/api/gemini/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64Audio, mimeType: "audio/webm" }),
          });
          const result = await response.json();
          if (result.transcript) {
            setVoiceInput(result.transcript);
            handleVoiceCallConvo(result.transcript);
          }
        } catch (err: any) {
          console.error("Transcribing voice input failed:", err);
        } finally {
          setIsTranscribing(false);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsVoiceRecording(true);

      audioTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error(err);
    }
  };

  const stopVoiceRecording = () => {
    if (voiceRecorderRef.current && isVoiceRecording) {
      voiceRecorderRef.current.stop();
      setIsVoiceRecording(false);
      if (audioTimerRef.current) {
        clearInterval(audioTimerRef.current);
        audioTimerRef.current = null;
      }
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/bot/config");
      const data = await res.json();
      setConfig(data);
      setFormConfig(data);
    } catch (e) {}
  };

  const fetchCommands = async () => {
    try {
      const res = await fetch("/api/bot/commands");
      const data = await res.json();
      setCommands(data);
    } catch (e) {}
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/bot/status");
      const data = await res.json();
      setStatus(data.status);
      setLogs(data.logs);

      // If status is QR Ready, fetch the base64 QR code image
      if (data.status === "qr_ready") {
        const qrRes = await fetch("/api/bot/qr");
        const qrData = await qrRes.json();
        if (qrData.qrUrl) {
          setQrUrl(qrData.qrUrl);
        }
      } else {
        setQrUrl(null);
      }
    } catch (e) {}
  };

  // Bot actions
  const startBot = async () => {
    try {
      await fetch("/api/bot/start", { method: "POST" });
      fetchStatus();
    } catch (e) {}
  };

  const stopBot = async () => {
    try {
      await fetch("/api/bot/stop", { method: "POST" });
      fetchStatus();
    } catch (e) {}
  };

  const clearBotLogs = async () => {
    try {
      await fetch("/api/bot/clear-logs", { method: "POST" });
      fetchStatus();
    } catch (e) {}
  };

  // Save config
  const saveConfig = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const res = await fetch("/api/bot/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formConfig),
      });
      const data = await res.json();
      if (!res.ok) {
        addSystemLog(`ERROR: Config not saved: ${data.error || res.status}`);
        return;
      }
      setConfig(data);
      setFormConfig(data);
      // Notify simulator about change if profile info changed
      addSystemLog("SYSTEM: Config updated successfully.");
    } catch (e) {
      addSystemLog("ERROR: Could not reach server to save config.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Load command code for edit
  const loadCommandCode = async (cmd: BotCommand) => {
    try {
      setSelectedCommand(cmd);
      setCommandCode("// Loading command code...");
      const res = await fetch(`/api/bot/commands/${cmd.name}`);
      const data = await res.json();
      setCommandCode(data.code || "");
    } catch (e) {}
  };

  // Save modified command code
  const saveCommandCode = async () => {
    if (!selectedCommand) return;
    setIsSavingCode(true);
    try {
      const res = await fetch("/api/bot/commands/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedCommand.name,
          code: commandCode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addSystemLog(`SUCCESS: ${data.message || `Command ${selectedCommand.name} saved.`}`);
        fetchCommands();
      } else {
        addSystemLog(`ERROR: ${data.error || "Failed to save command."}`);
      }
    } catch (e) {
      addSystemLog("ERROR: Could not reach server to save command.");
    } finally {
      setIsSavingCode(false);
    }
  };

  // Create new AI command
  const generateAICommand = async (e: FormEvent) => {
    e.preventDefault();
    if (!aiPrompt || !aiCmdName) return;
    setIsGeneratingCommand(true);
    setAiGenMessage("🧬 Nebula AI is synthesizing the code...");
    try {
      const res = await fetch("/api/bot/commands/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          commandName: aiCmdName,
          category: aiCmdCategory,
          description: aiCmdDesc,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiGenMessage(`✅ Command ${aiCmdName} successfully created and hot-loaded!`);
        setAiPrompt("");
        setAiCmdName("");
        setAiCmdDesc("");
        fetchCommands();
      } else {
        setAiGenMessage(`❌ Failed: ${data.error || "Generation failed"}`);
      }
    } catch (e: any) {
      setAiGenMessage(`❌ Error: ${e.message}`);
    } finally {
      setIsGeneratingCommand(false);
    }
  };

  // Run a command in the simulation playground from documentation
  const simulateCommandFromDoc = async (cmdText: string) => {
    if (isSimulating) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: "user",
      senderName: "Owner",
      text: cmdText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsSimulating(true);

    try {
      const res = await fetch("/api/bot/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: "Owner",
          text: cmdText,
        }),
      });
      const data = await res.json();

      const botReply: ChatMessage = {
        id: Math.random().toString(),
        sender: "bot",
        senderName: config.botName,
        text: data.text || `🤖 Commands start with prefix \`${config.prefix}\`. Type \`${config.prefix}menu\` for services!`,
        imageUrl: data.imageUrl,
        emoji: data.emoji,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, botReply]);
    } catch (e) {
      const errorReply: ChatMessage = {
        id: Math.random().toString(),
        sender: "bot",
        senderName: config.botName,
        text: "❌ *Error contacting bot simulator engine.* Is the server running?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsSimulating(false);
    }
  };

  // Chat simulator send
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsgText = inputValue;
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: "user",
      senderName: "Owner",
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsSimulating(true);

    try {
      const res = await fetch("/api/bot/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: "Owner",
          text: userMsgText,
        }),
      });
      const data = await res.json();

      const botReply: ChatMessage = {
        id: Math.random().toString(),
        sender: "bot",
        senderName: config.botName,
        text: data.text || `🤖 Commands start with prefix \`${config.prefix}\`. Type \`${config.prefix}menu\` for services!`,
        imageUrl: data.imageUrl,
        emoji: data.emoji,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, botReply]);
    } catch (e) {
      const errorReply: ChatMessage = {
        id: Math.random().toString(),
        sender: "bot",
        senderName: config.botName,
        text: "❌ *Error contacting bot simulator engine.* Is the server running?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSendVoiceNote = async () => {
    if (isSimulating) return;

    const voiceMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: "user",
      senderName: "Owner",
      text: "🎙️ Voice note (0:07)",
      isAudio: true,
      audioDuration: "0:07",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, voiceMsg]);
    setIsSimulating(true);

    try {
      const res = await fetch("/api/bot/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: "Owner",
          text: "🎙️ [Voice Note]",
        }),
      });
      const data = await res.json();

      const botReply: ChatMessage = {
        id: Math.random().toString(),
        sender: "bot",
        senderName: config.botName,
        text: data.text || "🤖 Thank you for the voice note!",
        imageUrl: data.imageUrl,
        emoji: data.emoji,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, botReply]);
    } catch (e) {
      const errorReply: ChatMessage = {
        id: Math.random().toString(),
        sender: "bot",
        senderName: config.botName,
        text: "❌ *Error contacting bot simulator engine.* Is the server running?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsSimulating(false);
    }
  };

  const retryConnection = async () => {
    setIsRetrying(true);
    addSystemLog("🔌 Retrying QR Code Connection...");
    try {
      await fetch("/api/bot/stop", { method: "POST" });
      await new Promise((resolve) => setTimeout(resolve, 800));
      await fetch("/api/bot/start", { method: "POST" });
      await fetchStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setIsRetrying(false);
    }
  };

  const addSystemLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev]);
  };

  const filteredMessages = chatMessages.filter((msg) => {
    if (!chatSearchQuery.trim()) return true;
    const query = chatSearchQuery.toLowerCase();
    return (
      msg.text.toLowerCase().includes(query) ||
      (msg.senderName && msg.senderName.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" id="app_root">
      {/* Dynamic Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm" id="header_section">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Bot className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              {config.botName}
              <span className="text-xs font-normal text-slate-400">v1.1.0 Multi-Device</span>
            </h1>
            <p className="text-xs text-slate-500">Lightweight, modular, customizable WhatsApp controller</p>
          </div>
        </div>

        {/* Engine Controls & Status */}
        <div className="flex items-center gap-4 flex-wrap" id="engine_controls">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-semibold">
            <span>Status:</span>
            {status === "connected" && (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                Connected
              </span>
            )}
            {status === "connecting" && (
              <span className="flex items-center gap-1.5 text-amber-500">
                <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" />
                Connecting
              </span>
            )}
            {status === "qr_ready" && (
              <span className="flex items-center gap-1.5 text-indigo-600">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse" />
                Scan QR Code
              </span>
            )}
            {status === "disconnected" && (
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2.5 h-2.5 bg-slate-400 rounded-full" />
                Offline
              </span>
            )}
            {status === "error" && (
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                Error
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {status === "disconnected" || status === "error" ? (
              <button
                onClick={startBot}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                id="btn_start_bot"
              >
                <Zap className="w-3.5 h-3.5" />
                Start Bot Connection
              </button>
            ) : (
              <button
                onClick={stopBot}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                id="btn_stop_bot"
              >
                <XCircle className="w-3.5 h-3.5" />
                Disconnect Bot
              </button>
            )}

            <button
              onClick={fetchStatus}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Refresh Status"
              id="btn_refresh_status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6" id="main_content">
        {/* Left Workspace Panel: Tabs & Actions (7 columns) */}
        <section className="lg:col-span-7 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden" id="workspace_panel">
          {/* Navigation Bar */}
          <div className="bg-slate-50 border-b border-slate-200 flex p-1 gap-1 overflow-x-auto select-none" id="tab_navigation">
            <button
              onClick={() => setActiveTab("control")}
              className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === "control" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings & Access
            </button>
            <button
              onClick={() => setActiveTab("commands")}
              className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === "commands" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Code2 className="w-4 h-4" />
              Command Customizer
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex-1 min-w-[110px] py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === "logs" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Terminal className="w-4 h-4" />
              Console Logs
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === "analytics" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Analytics & AI
            </button>
            <button
              onClick={() => setActiveTab("documentation")}
              className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === "documentation" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Documentation
            </button>
            <button
              onClick={() => setActiveTab("export")}
              className={`flex-1 min-w-[90px] py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === "export" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          {/* Active Tab Container */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[640px]" id="tab_contents">
            <AnimatePresence mode="wait">
              {/* Tab 1: Control & Settings */}
              {activeTab === "control" && (
                <motion.div
                  key="tab-control"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  {/* QR Scan Area */}
                  {status === "qr_ready" && qrUrl ? (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center space-y-4 shadow-sm" id="qr_scan_zone">
                      <div className="inline-block p-4 bg-white rounded-2xl shadow-md border border-indigo-100">
                        <img src={qrUrl} alt="WhatsApp QR Code" className="w-[200px] h-[200px]" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-slate-900">Link your WhatsApp Account</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Open WhatsApp on your phone, go to Linked Devices &gt; Link a Device, and scan this QR code.
                        </p>
                        <button
                          onClick={retryConnection}
                          disabled={isRetrying}
                          className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm mx-auto cursor-pointer"
                          id="btn_retry_connection"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                          {isRetrying ? 'Regenerating...' : 'Retry Connection'}
                        </button>
                      </div>
                    </div>
                  ) : status === "connected" ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex items-center gap-4 shadow-sm" id="connected_zone">
                      <div className="p-3 bg-white text-emerald-600 rounded-xl shadow-sm">
                        <CheckCircle className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">Nebula Bot is Connected!</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          The active connection with WhatsApp Web is stable. Try messaging your bot from your phone!
                        </p>
                      </div>
                    </div>
                  ) : status === "connecting" ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-center space-y-3" id="connecting_zone">
                      <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">Starting Socket Handshake...</h3>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                          Establishing connection with WhatsApp Web WebSocket. QR code or confirmation will appear shortly.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-3" id="disconnected_zone">
                      <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">Bot is Currently Offline</h3>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                          Start the live connection in the top header or configure details to use the simulator playground on the right.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Config Form */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Settings className="w-4 h-4 text-indigo-500" />
                      <h3 className="font-bold text-slate-900 text-sm">Bot Parameters</h3>
                    </div>

                    <form onSubmit={saveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Bot Name</label>
                        <input
                          type="text"
                          value={formConfig.botName}
                          onChange={(e) => setFormConfig({ ...formConfig, botName: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 transition shadow-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Prefix</label>
                        <input
                          type="text"
                          value={formConfig.prefix}
                          onChange={(e) => setFormConfig({ ...formConfig, prefix: e.target.value })}
                          maxLength={2}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 transition shadow-sm"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-bold text-slate-600">Bot Image URL (Avatar)</label>
                        <input
                          type="url"
                          value={formConfig.botImage}
                          onChange={(e) => setFormConfig({ ...formConfig, botImage: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 transition shadow-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Owner Number (With Country Code)</label>
                        <input
                          type="text"
                          value={formConfig.ownerNumber}
                          placeholder="e.g. 1234567890"
                          onChange={(e) => setFormConfig({ ...formConfig, ownerNumber: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 transition shadow-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Newsletter Channel Name</label>
                        <input
                          type="text"
                          value={formConfig.newsletterName}
                          onChange={(e) => setFormConfig({ ...formConfig, newsletterName: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 transition shadow-sm"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-bold text-slate-600">Newsletter Channel URL</label>
                        <input
                          type="url"
                          value={formConfig.newsletterUrl}
                          onChange={(e) => setFormConfig({ ...formConfig, newsletterUrl: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 transition shadow-sm"
                        />
                      </div>

                      <div className="md:col-span-2 flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={isSavingConfig}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                        >
                          {isSavingConfig ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Save Config Settings
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}

              {/* Tab 2: Custom Commands Manager */}
              {activeTab === "commands" && (
                <motion.div
                  key="tab-commands"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  {/* Split Layout: Commands List and Code Editor */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Command list */}
                    <div className="md:col-span-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Command Registry</h4>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                          {commands.length} Commands
                        </span>
                      </div>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                        {commands.map((cmd) => (
                          <button
                            key={cmd.name}
                            onClick={() => loadCommandCode(cmd)}
                            className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition cursor-pointer ${
                              selectedCommand?.name === cmd.name
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "bg-white hover:bg-slate-100 border border-slate-100"
                            }`}
                          >
                            <div>
                              <div className="font-bold text-xs">{config.prefix}{cmd.name}</div>
                              <div className={`text-[10px] ${selectedCommand?.name === cmd.name ? "text-indigo-100" : "text-slate-500"} mt-0.5`}>
                                {cmd.description.slice(0, 45)}{cmd.description.length > 45 ? "..." : ""}
                              </div>
                            </div>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                              selectedCommand?.name === cmd.name ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600"
                            }`}>
                              {cmd.category}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* AI Command Generator Tool */}
                      <form onSubmit={generateAICommand} className="bg-indigo-50/60 border border-indigo-100/50 p-4 rounded-xl space-y-3 shadow-sm">
                        <div className="flex items-center gap-1.5 text-indigo-700">
                          <Sparkles className="w-4 h-4" />
                          <h4 className="font-bold text-xs">AI Smart Command Creator</h4>
                        </div>
                        <p className="text-[10px] text-indigo-600/80">
                          Describe your command in plain English. Gemini will automatically design, write and compile the code!
                        </p>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-indigo-800">Command Trigger</label>
                          <input
                            type="text"
                            placeholder="e.g. quote"
                            value={aiCmdName}
                            onChange={(e) => setAiCmdName(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs focus:outline-indigo-500"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-indigo-800">Category</label>
                            <input
                              type="text"
                              value={aiCmdCategory}
                              onChange={(e) => setAiCmdCategory(e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs focus:outline-indigo-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-indigo-800">Brief Description</label>
                            <input
                              type="text"
                              value={aiCmdDesc}
                              placeholder="Describe it"
                              onChange={(e) => setAiCmdDesc(e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs focus:outline-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-indigo-800">AI Prompt Instruction</label>
                          <textarea
                            placeholder="e.g. Fetches a funny quote and responds in WhatsApp"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs focus:outline-indigo-500 resize-none"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isGeneratingCommand}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          {isGeneratingCommand ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          Generate Code with Gemini
                        </button>

                        {aiGenMessage && (
                          <div className="p-2.5 bg-white border border-indigo-100 rounded-lg text-[10px] text-slate-700 font-medium">
                            {aiGenMessage}
                          </div>
                        )}
                      </form>
                    </div>

                    {/* Editor workspace */}
                    <div className="md:col-span-7 space-y-3">
                      {selectedCommand ? (
                        <div className="space-y-3 h-full flex flex-col justify-between">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div>
                              <h4 className="font-bold text-xs text-slate-800">
                                Editing: <span className="text-indigo-600">{config.prefix}{selectedCommand.name}.ts</span>
                              </h4>
                              <p className="text-[10px] text-slate-500">{selectedCommand.description}</p>
                            </div>

                            <button
                              onClick={saveCommandCode}
                              disabled={isSavingCode}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-sm"
                            >
                              {isSavingCode ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                              Save Code
                            </button>
                          </div>

                          <textarea
                            value={commandCode}
                            onChange={(e) => setCommandCode(e.target.value)}
                            className="w-full flex-1 min-h-[350px] p-4 font-mono text-xs bg-slate-900 text-slate-100 rounded-xl focus:outline-none resize-y border border-slate-800 shadow-md leading-relaxed"
                            style={{ whiteSpace: "pre" }}
                          />
                        </div>
                      ) : (
                        <div className="h-full min-h-[300px] border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-6 space-y-2">
                          <Code2 className="w-8 h-8 text-slate-300" />
                          <h4 className="font-bold text-slate-700 text-xs">No Command Selected</h4>
                          <p className="text-[10px] text-slate-400 max-w-xs">
                            Select a command file on the left side to view or customize its TypeScript logic, or use our AI Generator to create a new command instantly.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Tab 3: System logs */}
              {activeTab === "logs" && (
                <motion.div
                  key="tab-logs"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-slate-600" />
                      <h3 className="font-bold text-slate-900 text-sm">Engine Console Output</h3>
                    </div>

                    <button
                      onClick={clearBotLogs}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Console Logs
                    </button>
                  </div>

                  {/* Terminal Window */}
                  <div className="bg-slate-950 rounded-2xl p-4 border border-slate-900 shadow-lg min-h-[350px] max-h-[450px] overflow-y-auto flex flex-col font-mono text-[11px] leading-relaxed select-text text-slate-200">
                    {logs.length === 0 ? (
                      <span className="text-slate-500">_waiting for socket activities..._</span>
                    ) : (
                      logs.map((log, index) => {
                        let colorClass = "text-slate-300";
                        if (log.includes("✅") || log.includes("connected") || log.includes("SUCCESS")) {
                          colorClass = "text-emerald-400";
                        } else if (log.includes("⚠️") || log.includes("WARNING")) {
                          colorClass = "text-amber-400";
                        } else if (log.includes("❌") || log.includes("Error") || log.includes("failed")) {
                          colorClass = "text-rose-400";
                        } else if (log.includes("💬") || log.includes("Executing")) {
                          colorClass = "text-indigo-400";
                        }
                        return (
                          <div key={index} className={`${colorClass} py-0.5 border-b border-slate-900/35`}>
                            {log}
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}

              {/* Tab 4: Export Bot package */}
              {activeTab === "export" && (
                <motion.div
                  key="tab-export"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm" id="export_box">
                    <div className="space-y-2 text-center md:text-left max-w-lg">
                      <h3 className="font-bold text-slate-900 text-base">Run Nebula Bot Locally</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Export your current configuration, customization, and commands directly into a self-contained local Node package. It includes all dependencies, ready-to-run startup scripts, automatic QR output in your local terminal, and clean multi-device session authentication.
                      </p>
                    </div>

                    <a
                      href="/api/bot/download-zip"
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md whitespace-nowrap cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Download Complete ZIP
                    </a>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">Deploying in 3 steps</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-1">
                        <div className="text-lg font-bold text-indigo-500">01</div>
                        <h5 className="font-bold text-slate-800 text-xs">Extract & Install</h5>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Unzip the downloaded pack into any directory. Open your terminal and run <code className="bg-slate-200 text-slate-800 px-1 rounded">npm install</code> to install dependencies.
                        </p>
                      </div>

                      <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-1">
                        <div className="text-lg font-bold text-indigo-500">02</div>
                        <h5 className="font-bold text-slate-800 text-xs">Set API Keys</h5>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Edit the generated <code className="bg-slate-200 text-slate-800 px-1 rounded">.env</code> file with your <code className="bg-slate-200 text-slate-800 px-1">GEMINI_API_KEY</code> to enable AI features on your own VPS or local server.
                        </p>
                      </div>

                      <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-1">
                        <div className="text-lg font-bold text-indigo-500">03</div>
                        <h5 className="font-bold text-slate-800 text-xs">Launch & Link</h5>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Run <code className="bg-slate-200 text-slate-800 px-1 rounded">npm start</code>. A QR code will print in the console. Scan it using Linked Devices from WhatsApp, and your bot is online!
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "analytics" && (
                <motion.div
                  key="tab-analytics"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  {/* Top: Recharts Pie Chart */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4" id="analytics_metrics_section">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">Command Frequencies</h3>
                        <p className="text-[10px] text-slate-500">Real-time usage metrics of the bot commands</p>
                      </div>
                      <div className="px-2 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-bold text-indigo-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                        Live tracking
                      </div>
                    </div>

                    <div className="h-[240px] flex items-center justify-center" id="pie_chart_container">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(analyticsStats).map(([name, value]) => ({
                              name: `${config.prefix}${name}`,
                              value
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {Object.entries(analyticsStats).map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#64748b"][index % 7]} 
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px", fontWeight: "600" }} 
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={36} 
                            iconType="circle" 
                            iconSize={8}
                            wrapperStyle={{ fontSize: "10px", fontWeight: "600" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Middle: 2-Column AI Playground grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Column 1: Audio Transcriber */}
                    <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-4 flex flex-col justify-between shadow-sm">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-indigo-600">
                          <Mic className="w-4 h-4" />
                          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Transcribe Audio</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Speak into your microphone and watch Gemini 3.5-flash convert the raw binary wave format into pristine text.
                        </p>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 min-h-[100px] flex flex-col justify-center items-center text-center">
                        {isTranscribing ? (
                          <div className="space-y-2">
                            <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin mx-auto" />
                            <p className="text-[10px] text-indigo-600 font-semibold">Gemini is transcribing...</p>
                          </div>
                        ) : transcriptionText ? (
                          <p className="text-xs text-slate-800 font-medium italic leading-relaxed">
                            "{transcriptionText}"
                          </p>
                        ) : isRecording ? (
                          <div className="space-y-1.5 animate-pulse">
                            <div className="flex items-center justify-center gap-1">
                              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                              <span className="text-xs font-bold text-rose-600">RECORDING</span>
                            </div>
                            <p className="text-[10px] text-slate-500">{recordingSeconds}s elapsed</p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400">Your transcribed text will appear here</p>
                        )}
                      </div>

                      <div>
                        {isRecording ? (
                          <button
                            onClick={stopRecording}
                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
                          >
                            Stop & Transcribe
                          </button>
                        ) : (
                          <button
                            onClick={startRecording}
                            disabled={isTranscribing}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Mic className="w-3.5 h-3.5" />
                            Record Microphone
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Column 2: Voice Conversation (Live API) */}
                    <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-4 flex flex-col justify-between shadow-sm">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-indigo-600">
                          <Sparkles className="w-4 h-4" />
                          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Voice Conversation (Live API)</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Talk with Gemini 3.1-flash-live-preview. Speak into your mic or type a prompt to hear Gemini respond in real-time.
                        </p>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 min-h-[100px] flex flex-col justify-between">
                        {/* Audio element for hidden streaming/playing */}
                        <audio ref={audioPlayerRef} className="hidden" onEnded={() => setIsPlayingVoice(false)} />
                        
                        <div className="flex-1 flex flex-col justify-center items-center text-center">
                          {isVoiceResponding ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-center gap-1">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                              <p className="text-[10px] text-indigo-500 font-semibold">Gemini is thinking...</p>
                            </div>
                          ) : isVoiceRecording ? (
                            <div className="space-y-1 animate-pulse">
                              <span className="text-xs font-bold text-rose-500">LISTENING...</span>
                              <p className="text-[10px] text-slate-400">Say what you want to ask Gemini</p>
                            </div>
                          ) : voiceReplyText ? (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-indigo-600">Gemini Speaks:</p>
                              <p className="text-xs text-slate-800 leading-relaxed italic">"{voiceReplyText}"</p>
                              {isPlayingVoice && (
                                <div className="flex items-center justify-center gap-0.5 pt-1.5">
                                  {[...Array(8)].map((_, i) => (
                                    <div 
                                      key={i} 
                                      className="w-1 bg-indigo-500 rounded-full animate-pulse" 
                                      style={{ 
                                        height: `${Math.random() * 16 + 6}px`,
                                        animationDuration: `${0.4 + Math.random() * 0.4}s` 
                                      }} 
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400">Start a conversation using mic or text below</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {/* Mic voice-conversations input OR text input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={voiceInput}
                            onChange={(e) => setVoiceInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleVoiceCallConvo(voiceInput)}
                            placeholder="Type to converse..."
                            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                          <button
                            onClick={() => handleVoiceCallConvo(voiceInput)}
                            disabled={isVoiceResponding || !voiceInput.trim()}
                            className="px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                          >
                            Call
                          </button>
                        </div>

                        {isVoiceRecording ? (
                          <button
                            onClick={stopVoiceRecording}
                            className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-xl transition shadow-sm cursor-pointer"
                          >
                            Stop Speaking
                          </button>
                        ) : (
                          <button
                            onClick={startVoiceRecording}
                            disabled={isVoiceResponding}
                            className="w-full py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Mic className="w-3 h-3" />
                            Record Voice Response
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Tab 6: Interactive Documentation Directory */}
              {activeTab === "documentation" && (
                <motion.div
                  key="tab-documentation"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-600 animate-pulse" />
                        Interactive Command Directory
                      </h3>
                      <p className="text-xs text-slate-500">
                        Explore syntax parameters, copy templates, or simulate queries directly in the playground.
                      </p>
                    </div>

                    {/* Search Field */}
                    <div className="relative w-full md:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Search commands or aliases..."
                        value={docSearchQuery}
                        onChange={(e) => setDocSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 transition shadow-sm font-medium"
                      />
                      {docSearchQuery && (
                        <button
                          onClick={() => setDocSearchQuery("")}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {["All", ...Array.from(new Set(commands.map((cmd) => cmd.category)))].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setDocSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none ${
                          docSelectedCategory === cat
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Commands Reference Container */}
                  <div className="space-y-4">
                    {(() => {
                      const filteredDocCommands = commands.filter((cmd) => {
                        const matchesCategory = docSelectedCategory === "All" || cmd.category === docSelectedCategory;
                        const matchesSearch =
                          cmd.name.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
                          cmd.description.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
                          (cmd.aliases && cmd.aliases.some((alias) => alias.toLowerCase().includes(docSearchQuery.toLowerCase()))) ||
                          cmd.usage.toLowerCase().includes(docSearchQuery.toLowerCase());
                        return matchesCategory && matchesSearch;
                      });

                      if (filteredDocCommands.length === 0) {
                        return (
                          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                            <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                            <h4 className="font-bold text-slate-700 text-xs">No Commands Found</h4>
                            <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                              We couldn't find any commands matching "{docSearchQuery}" in category "{docSelectedCategory}".
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                          <table className="w-full text-left border-collapse bg-white">
                            <thead>
                              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-bold tracking-wider select-none">
                                <th className="p-4 w-[25%]">Command & Alias</th>
                                <th className="p-4 w-[35%]">Syntax & Params</th>
                                <th className="p-4 w-[25%]">Description</th>
                                <th className="p-4 w-[15%] text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {filteredDocCommands.map((cmd) => {
                                const { cleanUsage, parameters, example } = parseUsageAndParams(cmd.usage, cmd.name, config.prefix);
                                
                                return (
                                  <tr key={cmd.name} className="hover:bg-slate-50/50 transition duration-150">
                                    {/* Command Name and Category / Aliases */}
                                    <td className="p-4 align-top space-y-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                          {config.prefix}{cmd.name}
                                        </span>
                                        <span className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded-full uppercase">
                                          {cmd.category}
                                        </span>
                                      </div>

                                      {/* Aliases */}
                                      {cmd.aliases && cmd.aliases.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <span className="text-[9px] text-slate-400 select-none">Alt:</span>
                                          {cmd.aliases.map((alias) => (
                                            <span key={alias} className="text-[9px] bg-slate-50 text-slate-500 font-mono px-1 py-0.5 border border-slate-100 rounded">
                                              {config.prefix}{alias}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </td>

                                    {/* Syntax & Parameters list */}
                                    <td className="p-4 align-top space-y-2">
                                      <div className="font-mono text-[11px] text-slate-700 bg-slate-50/80 p-2 border border-slate-100 rounded-lg select-all max-w-full overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                        {cleanUsage}
                                      </div>

                                      {/* Parameter Tags Breakdown */}
                                      {parameters.length > 0 ? (
                                        <div className="space-y-1">
                                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider select-none">Parameter Keys:</div>
                                          <div className="flex flex-wrap gap-1.5">
                                            {parameters.map((param, idx) => (
                                              <span 
                                                key={idx} 
                                                className={`text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                                  param.required 
                                                    ? "bg-rose-50 text-rose-600 border border-rose-100" 
                                                    : "bg-sky-50 text-sky-600 border border-sky-100"
                                                }`}
                                              >
                                                <span className={`w-1 h-1 rounded-full ${param.required ? "bg-rose-500" : "bg-sky-500"}`} />
                                                {param.name}: {param.required ? "required" : "optional"}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-[9px] text-slate-400 italic block select-none">No variables or arguments required.</span>
                                      )}
                                    </td>

                                    {/* Description */}
                                    <td className="p-4 align-top text-slate-600 text-xs leading-relaxed">
                                      {cmd.description}
                                    </td>

                                    {/* Copy & Play actions */}
                                    <td className="p-4 align-top text-right space-y-2">
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(example);
                                          setCopiedCommandName(cmd.name);
                                          setTimeout(() => setCopiedCommandName(null), 1800);
                                        }}
                                        className="w-full px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer select-none border border-slate-200"
                                        title="Copy sample command usage"
                                      >
                                        {copiedCommandName === cmd.name ? (
                                          <>
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            <span className="text-emerald-600">Copied!</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Copy Sample</span>
                                          </>
                                        )}
                                      </button>

                                      <button
                                        onClick={() => simulateCommandFromDoc(example)}
                                        disabled={isSimulating}
                                        className="w-full px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 text-indigo-600 disabled:text-slate-400 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer select-none border border-indigo-100"
                                        title="Trigger simulation immediately"
                                      >
                                        <Play className="w-3 h-3 fill-current" />
                                        <span>Run Live</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Right Columns: High Fidelity WhatsApp Live Simulator (5 columns) */}
        <section className="lg:col-span-5 flex flex-col bg-slate-100 border border-slate-200 rounded-3xl shadow-sm overflow-hidden h-[600px] relative" id="simulator_section">
          {/* WhatsApp Header Mockup */}
          <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between shadow-md" id="whatsapp_header">
            <div className="flex items-center gap-3">
              {/* Profile Image */}
              <div className="relative">
                <img
                  src={config.botImage}
                  alt={config.botName}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#075e54] rounded-full" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight">{config.botName}</h3>
                <p className="text-[10px] text-emerald-100">
                  {isSimulating ? "typing..." : "online | controller simulator"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-emerald-100 text-xs bg-[#128c7e] px-2.5 py-1 rounded-full border border-[#075e54]">
              <Globe className="w-3.5 h-3.5" />
              <span>Prefix: <strong className="text-white">{config.prefix}</strong></span>
            </div>
          </div>

          {/* Search bar inside the WhatsApp Simulator */}
          <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-2" id="whatsapp_search_bar">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search messages..."
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                className="w-full bg-slate-100 text-slate-700 text-xs pl-8 pr-8 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                id="chat_search_input"
              />
              {chatSearchQuery && (
                <button
                  onClick={() => setChatSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-500 transition"
                  id="btn_clear_chat_search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {chatSearchQuery && (
              <span className="text-[10px] text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full shrink-0 font-medium select-none">
                {filteredMessages.length} found
              </span>
            )}
          </div>

          {/* Active Chat Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#e5ddd5]" style={{ backgroundImage: 'radial-gradient(#dfdcd6 15%, transparent 16%)', backgroundSize: '16px 16px' }} id="whatsapp_feed">
            {filteredMessages.length === 0 && chatSearchQuery.trim() !== "" ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 space-y-2 bg-white/90 p-6 rounded-2xl max-w-[280px] mx-auto shadow-sm" id="search_empty_state">
                <Search className="w-8 h-8 text-slate-400 stroke-[1.5]" />
                <p className="font-semibold text-xs text-slate-700">No matching messages</p>
                <p className="text-[10px] text-slate-400">Couldn't find any simulator messages matching "{chatSearchQuery}".</p>
                <button
                  onClick={() => setChatSearchQuery("")}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-semibold transition cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            ) : (
              filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}
              >
                {/* Sender Tag */}
                <span className="text-[10px] text-slate-500 mb-0.5 px-1">{msg.senderName}</span>
                
                {/* Message bubble */}
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm relative ${
                    msg.sender === "user"
                      ? "bg-[#dcf8c6] text-slate-800 rounded-tr-none"
                      : "bg-white text-slate-800 rounded-tl-none"
                  }`}
                >
                  {/* Optional Image attachment */}
                  {msg.imageUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden max-w-[200px] border border-slate-100">
                      <img src={msg.imageUrl} alt="AI output" className="w-full h-auto object-cover" />
                    </div>
                  )}

                  {/* Body text or voice note rendering */}
                  {msg.isAudio ? (
                    <div className="flex items-center gap-3 py-1.5 min-w-[210px]" id={`audio_msg_${msg.id}`}>
                      {/* Circular Play button */}
                      <div className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center text-white shrink-0 shadow-sm cursor-pointer">
                        <Play className="w-3 h-3 fill-white ml-0.5" />
                      </div>
                      {/* Waveform track */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-end gap-0.5 h-6">
                          <span className="w-0.5 bg-emerald-600 h-2 rounded-full animate-pulse" />
                          <span className="w-0.5 bg-emerald-600 h-4 rounded-full" />
                          <span className="w-0.5 bg-emerald-600 h-5 rounded-full animate-pulse" />
                          <span className="w-0.5 bg-emerald-600 h-3 rounded-full" />
                          <span className="w-0.5 bg-emerald-600 h-6 rounded-full" />
                          <span className="w-0.5 bg-emerald-600 h-4 rounded-full animate-pulse" />
                          <span className="w-0.5 bg-emerald-400 h-2 rounded-full" />
                          <span className="w-0.5 bg-emerald-400 h-5 rounded-full" />
                          <span className="w-0.5 bg-emerald-400 h-3 rounded-full animate-pulse" />
                          <span className="w-0.5 bg-emerald-400 h-4 rounded-full" />
                          <span className="w-0.5 bg-emerald-400 h-2.5 rounded-full animate-pulse" />
                          <span className="w-0.5 bg-emerald-300 h-1.5 rounded-full" />
                          <span className="w-0.5 bg-emerald-300 h-3 rounded-full" />
                          <span className="w-0.5 bg-emerald-300 h-2 rounded-full" />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 leading-none">
                          <span>{msg.audioDuration || "0:07"}</span>
                          <Mic className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap select-text break-words">
                      {msg.text.split("\n").map((line, i) => {
                        // XSS-safe formatting: content is HTML-escaped first,
                        // then WhatsApp-style *bold*, _italic_ and `code` markup is applied.
                        const formatted = formatMessageLine(line);

                        return (
                          <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} className={i > 0 ? "mt-1" : ""} />
                        );
                      })}
                    </div>
                  )}

                  {/* Reaction Emoji */}
                  {msg.emoji && (
                    <span className="absolute -bottom-2 -right-1 bg-white border border-slate-100 text-xs p-0.5 px-1.5 rounded-full shadow-sm animate-bounce">
                      {msg.emoji}
                    </span>
                  )}

                  {/* Timestamp */}
                  <div className="text-[9px] text-slate-400 text-right mt-1.5 leading-none">
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            )))}

            {isSimulating && (
              <div className="mr-auto flex flex-col items-start max-w-[70%]">
                <span className="text-[10px] text-slate-500 mb-0.5 px-1">{config.botName}</span>
                <div className="bg-white p-3 rounded-2xl rounded-tl-none text-xs text-slate-400 shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* WhatsApp Message Input Panel */}
          <form onSubmit={handleSendMessage} className="bg-[#f0f0f0] p-3 flex items-center gap-2 border-t border-slate-200" id="whatsapp_input_form">
            <input
              type="text"
              placeholder={`Send message (start with prefix: '${config.prefix}')`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isSimulating}
              className="flex-1 bg-white border border-slate-200 rounded-full px-4 py-2 text-xs focus:outline-none focus:border-[#128c7e] shadow-sm"
              id="whatsapp_text_input"
            />
            
            <button
              type="button"
              onClick={handleSendVoiceNote}
              disabled={isSimulating}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-full transition shadow-md cursor-pointer flex items-center justify-center shrink-0"
              title="Simulate sending a Voice Note"
              id="whatsapp_voice_btn"
            >
              <Mic className="w-4 h-4" />
            </button>
            
            <button
              type="submit"
              disabled={!inputValue.trim() || isSimulating}
              className="p-2.5 bg-[#128c7e] hover:bg-[#075e54] disabled:bg-slate-300 text-white rounded-full transition shadow-md cursor-pointer flex items-center justify-center"
              id="whatsapp_send_btn"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      </main>

      {/* Footer Info bar */}
      <footer className="bg-white border-t border-slate-200 py-3 px-6 text-center text-slate-400 text-xs flex flex-col md:flex-row items-center justify-between gap-2" id="footer_section">
        <div className="flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-slate-400" />
          <span>Nebula Bot Project Dashboard & Controller</span>
        </div>
        <div className="flex items-center gap-4">
          <a href={config.newsletterUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition flex items-center gap-1">
            <Globe className="w-3 h-3" />
            Join News Channel
          </a>
          <span>© 2026 Nebula Bot Engine</span>
        </div>
      </footer>
    </div>
  );
}
