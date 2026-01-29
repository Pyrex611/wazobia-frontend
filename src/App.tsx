import React, { useState, useRef } from 'react';
import { Mic, Volume2, Globe2, Loader2, Send, Activity, Settings, X, Save } from 'lucide-react';

// --- TYPES & CONFIG ---
interface User { id: 'user1' | 'user2'; name: string; language: string; }
interface Message { 
  id: string; 
  userId: 'user1' | 'user2'; 
  textOriginal: string; 
  textTranslated: string; 
  audioUrl?: string; 
}

const SUPPORTED_LANGUAGES = [
  { code: 'eng_Latn', name: 'English', flag: '🇬🇧' },
  { code: 'yor_Latn', name: 'Yoruba', flag: '🇳🇬' },
  { code: 'hau_Latn', name: 'Hausa', flag: '🇳🇬' },
  { code: 'ibo_Latn', name: 'Igbo', flag: '🇳🇬' },
  { code: 'fra_Latn', name: 'French', flag: '🇫🇷' },
  { code: 'spa_Latn', name: 'Spanish', flag: '🇪🇸' },
  { code: 'zho_Hans', name: 'Chinese', flag: '🇨🇳' },
];

const INITIAL_USERS: [User, User] = [
  { id: 'user1', name: 'Speaker A', language: 'eng_Latn' },
  { id: 'user2', name: 'Speaker B', language: 'fra_Latn' },
];

const useRobustRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    audioChunks.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
      
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      mediaRecorder.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: mimeType });
        setAudioUrl(URL.createObjectURL(blob));
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (e) { alert("Microphone access denied."); }
  };

  const stopRecording = () => { mediaRecorder.current?.stop(); setIsRecording(false); };
  const reset = () => { setAudioUrl(null); setAudioBlob(null); };

  return { isRecording, audioBlob, audioUrl, startRecording, stopRecording, reset };
};

const WazobiaApp: React.FC = () => {
  const [backendUrl, setBackendUrl] = useState("https://f2da7dcc1676.ngrok-free.app"); 
  const [showSettings, setShowSettings] = useState(false);
  const [users, setUsers] = useState<[User, User]>(INITIAL_USERS);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const rec1 = useRobustRecorder();
  const rec2 = useRobustRecorder();

  const handleProcessAudio = async (userId: 'user1' | 'user2') => {
    const rec = userId === 'user1' ? rec1 : rec2;
    if (!rec.audioBlob) return;
    setIsProcessing(true);

    try {
      const srcUser = users[userId === 'user1' ? 0 : 1];
      const tgtUser = users[userId === 'user1' ? 1 : 0];

      const fd = new FormData();
      fd.append('audio', rec.audioBlob, 'input.webm');
      fd.append('src_lang', srcUser.language);
      fd.append('tgt_lang', tgtUser.language);

      const res = await fetch(`${backendUrl.replace(/\/$/, "")}/process-speech`, { 
        method: 'POST', 
        body: fd,
        headers: { "ngrok-skip-browser-warning": "true" }
      });
      const data = await res.json();

      if (data.audio_payload) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_payload}`);
        audio.play().catch(console.error);
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        userId,
        textOriginal: data.original_transcript,
        textTranslated: data.transcript,
        audioUrl: URL.createObjectURL(rec.audioBlob!)
      }]);
      rec.reset();
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg">Server Settings</h3>
                    <button onClick={() => setShowSettings(false)}><X size={20}/></button>
                </div>
                <label className="text-xs text-slate-400 mb-2 block uppercase">Backend URL</label>
                <input 
                    type="text" 
                    value={backendUrl}
                    onChange={(e) => setBackendUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 mb-6 outline-none focus:ring-1 focus:ring-green-500"
                />
                <button onClick={() => setShowSettings(false)} className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                    <Save size={18}/> Save Settings
                </button>
            </div>
        </div>
      )}

      <header className="border-b border-white/10 p-4 sticky top-0 bg-slate-950/50 backdrop-blur-md flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-black font-bold">W</div>
          <h1 className="text-xl font-semibold">Wazobia</h1>
        </div>
        <div className="flex items-center gap-3">
            {isProcessing && <Loader2 size={18} className="animate-spin text-green-500"/>}
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <Settings size={20} className="text-slate-400" />
            </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full p-4 overflow-y-auto space-y-6 pb-32">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-20 mt-20">
                <Globe2 size={64} className="mb-4 text-green-500"/>
                <p>Ready for live translation</p>
            </div>
        )}
        {messages.map(m => (
            <div key={m.id} className={`flex ${m.userId === 'user1' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-2xl p-4 border ${m.userId === 'user1' ? 'bg-slate-800/80 border-slate-700' : 'bg-green-900/30 border-green-800'}`}>
                <p className="text-xs text-slate-400 mb-2 italic">"{m.textOriginal}"</p>
                <p className="text-lg font-medium">{m.textTranslated}</p>
                <button onClick={() => new Audio(m.audioUrl).play()} className="mt-3 flex items-center gap-1 text-[10px] uppercase opacity-60 hover:opacity-100">
                  <Volume2 size={12}/> Play Original
                </button>
              </div>
            </div>
        ))}
      </main>

      <footer className="fixed bottom-0 w-full bg-slate-950/80 backdrop-blur-xl border-t border-white/10">
        <div className="max-w-3xl mx-auto p-4 grid grid-cols-2 gap-4">
          {[0, 1].map(i => {
              const u = users[i];
              const rec = i === 0 ? rec1 : rec2;
              return (
                <div key={u.id} className="flex flex-col gap-2">
                    <select value={u.language} onChange={(e) => {
                        const n = [...users] as [User, User];
                        n[i].language = e.target.value;
                        setUsers(n);
                    }} className="bg-slate-800 border border-slate-700 text-xs rounded-lg p-2 outline-none">
                        {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                    </select>
                    <div className="flex justify-center">
                        {rec.audioUrl ? (
                             <button onClick={() => handleProcessAudio(u.id)} className="w-full bg-green-600 h-14 rounded-xl font-bold flex items-center justify-center gap-2">
                                <Send size={18}/> Send
                            </button>
                        ) : (
                            <button onMouseDown={rec.startRecording} onMouseUp={rec.stopRecording} onTouchStart={rec.startRecording} onTouchEnd={rec.stopRecording}
                                className={`h-14 w-14 rounded-full flex items-center justify-center transition-all ${rec.isRecording ? 'bg-red-500 scale-110 animate-pulse' : 'bg-slate-700'}`}>
                                {rec.isRecording ? <Activity/> : <Mic/>}
                            </button>
                        )}
                    </div>
                </div>
              )
          })}
        </div>
      </footer>
    </div>
  );
};

export default WazobiaApp;