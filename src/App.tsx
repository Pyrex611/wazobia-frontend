import { useState, useRef } from 'react';
import { Mic, Globe2, Loader2, Send, Activity, Settings, Save, Trash2, Copy, Check, X } from 'lucide-react';

interface User { id: 'user1' | 'user2'; name: string; language: string; isLoading: boolean; }
interface Message { id: string; userId: 'user1' | 'user2'; textOriginal: string; textTranslated: string; }

const SUPPORTED_LANGUAGES = [
  { code: 'eng_Latn', name: 'English', flag: '🇬🇧' },
  { code: 'yor_Latn', name: 'Yoruba', flag: '🇳🇬' },
  { code: 'hau_Latn', name: 'Hausa', flag: '🇳🇬' },
  { code: 'ibo_Latn', name: 'Igbo', flag: '🇳🇬' },
  { code: 'fra_Latn', name: 'French', flag: '🇫🇷' },
  { code: 'spa_Latn', name: 'Spanish', flag: '🇪🇸' },
  { code: 'deu_Latn', name: 'German', flag: '🇩🇪' },
  { code: 'ita_Latn', name: 'Italian', flag: '🇮🇹' },
  { code: 'por_Latn', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'rus_Cyrl', name: 'Russian', flag: '🇷🇺' },
  { code: 'jpn_Jpan', name: 'Japanese', flag: '🇯🇵' },
  { code: 'kor_Kore', name: 'Korean', flag: '🇰🇷' },
  { code: 'arb_Arab', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hin_Deva', name: 'Hindi', flag: '🇮🇳' },
  { code: 'tur_Latn', name: 'Turkish', flag: '🇹🇷' },
  { code: 'vie_Latn', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'nld_Latn', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pol_Latn', name: 'Polish', flag: '🇵🇱' },
  { code: 'swe_Latn', name: 'Swedish', flag: '🇸🇪' },
  { code: 'ind_Latn', name: 'Indonesian', flag: '🇮🇩' },
];

export default function App() {
  const [backendUrl, setBackendUrl] = useState("https://f707caea8954.ngrok-free.app");
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [users, setUsers] = useState<[User, User]>([
    { id: 'user1', name: 'Speaker A', language: 'eng_Latn', isLoading: false },
    { id: 'user2', name: 'Speaker B', language: 'spa_Latn', isLoading: false },
  ]);

  const rec1 = useRecorder();
  const rec2 = useRecorder();

  // Helper to check if any recording/blob is active to show the X button
  const hasActiveInput = rec1.isRecording || rec1.audioBlob || rec2.isRecording || rec2.audioBlob;

  function useRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const chunks = useRef<Blob[]>([]);

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks.current = [];
        mediaRecorder.current = new MediaRecorder(stream);
        mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data);
        mediaRecorder.current.onstop = () => {
          const blob = new Blob(chunks.current, { type: 'audio/webm' });
          setAudioBlob(blob);
          // Stop all tracks to release microphone
          stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.current.start();
        setIsRecording(true);
      } catch (err) {
        alert("Microphone access denied or not available.");
        console.error(err);
      }
    };

    const stop = () => {
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
      }
      setIsRecording(false);
    };

    const toggle = () => (isRecording ? stop() : start());
    
    const reset = () => {
      stop();
      setAudioBlob(null);
      chunks.current = [];
    };

    return { isRecording, audioBlob, toggle, reset };
  }

  const handleDiscard = () => {
    rec1.reset();
    rec2.reset();
  };

  const handleProcess = async (index: number) => {
    const user = users[index];
    const rec = index === 0 ? rec1 : rec2;
    if (!rec.audioBlob || user.isLoading) return;

    const updatedUsers = [...users] as [User, User];
    updatedUsers[index].isLoading = true;
    setUsers(updatedUsers);

    try {
      const fd = new FormData();
      fd.append('audio', rec.audioBlob);
      fd.append('src_lang', user.language);
      fd.append('tgt_lang', users[index === 0 ? 1 : 0].language);

      const res = await fetch(`${backendUrl.replace(/\/$/, "")}/process-speech`, { 
        method: 'POST', body: fd, headers: { "ngrok-skip-browser-warning": "true" } 
      });
      
      if (!res.ok) throw new Error("Backend error");
      
      const data = await res.json();
      if (data.audio_payload) {
        new Audio(`data:audio/mp3;base64,${data.audio_payload}`).play().catch(e => console.log("Auto-play blocked", e));
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        userId: user.id,
        textOriginal: data.original_transcript,
        textTranslated: data.transcript,
      }]);
      rec.reset();
    } catch (e) { 
      alert("Error reaching backend. Check URL and connection."); 
    } finally {
      const resetUsers = [...users] as [User, User];
      resetUsers[index].isLoading = false;
      setUsers(resetUsers);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {showSettings && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-sm border border-slate-800 shadow-2xl">
            <h2 className="font-bold mb-4">Server Config</h2>
            <input className="w-full bg-black border border-slate-700 p-3 rounded-xl mb-6 text-sm outline-none focus:border-green-500" value={backendUrl} onChange={e=>setBackendUrl(e.target.value)} />
            <button onClick={()=>setShowSettings(false)} className="w-full bg-green-600 p-3 rounded-xl font-bold flex items-center justify-center gap-2">
              <Save size={18}/> Save Settings
            </button>
          </div>
        </div>
      )}

      <header className="p-4 flex justify-between items-center border-b border-white/5 sticky top-0 bg-slate-950/80 backdrop-blur-md z-10">
        <h1 className="text-xl font-bold italic">Wazobia</h1>
        <div className="flex items-center gap-4">
          {messages.length > 0 && (
            <button onClick={() => window.confirm("Clear all?") && setMessages([])} className="text-slate-500 hover:text-red-400">
              <Trash2 size={20}/>
            </button>
          )}
          <Settings className="text-slate-500 cursor-pointer" onClick={()=>setShowSettings(true)}/>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-52 max-w-2xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 opacity-20">
            <Globe2 size={48} className="mb-2 text-green-500"/>
            <p className="text-sm">Ready to translate</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.userId === 'user1' ? 'justify-start' : 'justify-end'}`}>
            <div className={`p-4 rounded-2xl max-w-[85%] relative group ${m.userId === 'user1' ? 'bg-slate-800 rounded-tl-none' : 'bg-green-900/20 border border-green-800/50 rounded-tr-none'}`}>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">"{m.textOriginal}"</p>
              <p className="text-lg leading-snug font-medium">{m.textTranslated}</p>
              <button onClick={() => { navigator.clipboard.writeText(m.textTranslated); setCopiedId(m.id); setTimeout(()=>setCopiedId(null), 2000); }} 
                className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 text-[10px] flex items-center gap-1">
                {copiedId === m.id ? <><Check size={12}/> Copied</> : <><Copy size={12}/> Copy</>}
              </button>
            </div>
          </div>
        ))}
      </main>

      <footer className="fixed bottom-0 left-0 w-full p-4 bg-slate-950/95 border-t border-white/5 backdrop-blur-lg">
        <div className="max-w-2xl mx-auto flex items-end gap-3">
          {/* User 1 Controls */}
          <div className="flex-1 flex flex-col gap-3">
            <select className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs outline-none focus:border-green-600 w-full" 
              value={users[0].language} 
              onChange={e => { const n = [...users] as [User, User]; n[0].language = e.target.value; setUsers(n); }}>
              {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
            
            <div className="h-16 flex items-center justify-center">
              {users[0].isLoading ? (
                 <div className="w-full h-14 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800"><Loader2 className="animate-spin text-green-500"/></div>
              ) : rec1.audioBlob ? (
                <button onClick={() => handleProcess(0)} className="w-full h-14 bg-green-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-500 transition-all shadow-lg shadow-green-900/20">
                  <Send size={18}/> Send
                </button>
              ) : (
                <button onClick={rec1.toggle} disabled={rec2.isRecording}
                  className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    rec1.isRecording ? 'bg-red-500 scale-110' : 'bg-slate-800 hover:bg-slate-700'
                  } ${rec2.isRecording ? 'opacity-30 cursor-not-allowed' : ''}`}>
                  {rec1.isRecording && <span className="absolute inset-0 rounded-full animate-ping bg-red-500/50"></span>}
                  {rec1.isRecording ? <Activity className="animate-pulse relative z-10"/> : <Mic size={24} className="relative z-10"/>}
                </button>
              )}
            </div>
          </div>

          {/* Central Discard Button */}
          <div className="h-16 flex items-center justify-center w-12 shrink-0 pb-1">
             {hasActiveInput && (
                <button onClick={handleDiscard} className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-700 flex items-center justify-center transition-all">
                  <X size={20} />
                </button>
             )}
          </div>

          {/* User 2 Controls */}
          <div className="flex-1 flex flex-col gap-3">
            <select className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs outline-none focus:border-green-600 w-full" 
              value={users[1].language} 
              onChange={e => { const n = [...users] as [User, User]; n[1].language = e.target.value; setUsers(n); }}>
              {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>

            <div className="h-16 flex items-center justify-center">
              {users[1].isLoading ? (
                 <div className="w-full h-14 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800"><Loader2 className="animate-spin text-green-500"/></div>
              ) : rec2.audioBlob ? (
                <button onClick={() => handleProcess(1)} className="w-full h-14 bg-green-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-500 transition-all shadow-lg shadow-green-900/20">
                  <Send size={18}/> Send
                </button>
              ) : (
                <button onClick={rec2.toggle} disabled={rec1.isRecording}
                  className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    rec2.isRecording ? 'bg-red-500 scale-110' : 'bg-slate-800 hover:bg-slate-700'
                  } ${rec1.isRecording ? 'opacity-30 cursor-not-allowed' : ''}`}>
                   {rec2.isRecording && <span className="absolute inset-0 rounded-full animate-ping bg-red-500/50"></span>}
                   {rec2.isRecording ? <Activity className="animate-pulse relative z-10"/> : <Mic size={24} className="relative z-10"/>}
                </button>
              )}
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}