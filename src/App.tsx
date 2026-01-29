import { useState, useRef } from 'react';
import { Mic, Globe2, Loader2, Send, Activity, Settings, Save, Trash2, Copy, Check } from 'lucide-react';

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
  const [backendUrl, setBackendUrl] = useState("https://5b4fefcef23c.ngrok-free.app");
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [users, setUsers] = useState<[User, User]>([
    { id: 'user1', name: 'Speaker A', language: 'eng_Latn', isLoading: false },
    { id: 'user2', name: 'Speaker B', language: 'spa_Latn', isLoading: false },
  ]);

  const rec1 = useRecorder();
  const rec2 = useRecorder();

  function useRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const chunks = useRef<Blob[]>([]);

    const start = async () => {
      chunks.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data);
      mediaRecorder.current.onstop = () => setAudioBlob(new Blob(chunks.current, { type: 'audio/webm' }));
      mediaRecorder.current.start();
      setIsRecording(true);
    };
    const stop = () => { mediaRecorder.current?.stop(); setIsRecording(false); };
    return { isRecording, audioBlob, start, stop, reset: () => setAudioBlob(null) };
  }

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
      const data = await res.json();
      if (data.audio_payload) new Audio(`data:audio/mp3;base64,${data.audio_payload}`).play();

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        userId: user.id,
        textOriginal: data.original_transcript,
        textTranslated: data.transcript,
      }]);
      rec.reset();
    } catch (e) { alert("Error reaching backend."); }
    finally {
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

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-44 max-w-2xl mx-auto w-full">
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
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-4">
          {[0, 1].map(i => {
            const rec = i === 0 ? rec1 : rec2;
            const u = users[i];
            return (
              <div key={u.id} className="flex flex-col gap-3">
                <select className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs outline-none focus:border-green-600" value={u.language} 
                  onChange={e => { const n = [...users] as [User, User]; n[i].language = e.target.value; setUsers(n); }}>
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
                <div className="flex justify-center">
                  {u.isLoading ? (
                    <div className="w-full h-14 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800"><Loader2 className="animate-spin text-green-500"/></div>
                  ) : rec.audioBlob ? (
                    <button onClick={() => handleProcess(i)} className="w-full h-14 bg-green-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-500 transition-all">
                      <Send size={18}/> Send
                    </button>
                  ) : (
                    <button onMouseDown={rec.start} onMouseUp={rec.stop} onTouchStart={rec.start} onTouchEnd={rec.stop}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${rec.isRecording ? 'bg-red-500 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-slate-800 hover:bg-slate-700'}`}>
                      {rec.isRecording ? <Activity className="animate-pulse"/> : <Mic size={24}/>}
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
}