import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, Play, Trash2, Settings, Database, Clock, Sliders, AlertTriangle, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { OnyxRecorder } from './utils/audio';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const triggerHaptic = (type = 'light') => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(type === 'light' ? 10 : 20);
    }
  } catch (e) {}
};

const TechnicalMic = ({ active }) => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="4" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" strokeOpacity={active ? 1 : 0.4} />
    <path d="M5 10C5 13.866 8.13401 17 12 17C15.866 17 19 13.866 19 10" stroke="currentColor" strokeWidth="1.5" strokeOpacity={active ? 1 : 0.2} />
    <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeOpacity={active ? 1 : 0.2} />
    <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="1.5" strokeOpacity={active ? 1 : 0.2} />
    {active && <circle cx="12" cy="9" r="1.2" fill="#C084FC" className="opacity-80" />}
  </svg>
);

const VUStrip = ({ value }) => {
  const level = (value / 255) * 100;
  return (
    <div className="w-full px-4">
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div animate={{ width: `${level}%` }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className={cn("h-full", level > 90 ? "bg-onyx-purple" : "bg-onyx-purple/50")} />
      </div>
    </div>
  );
};

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState(() => {
    const saved = localStorage.getItem('onyx_signal_archive');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map(r => ({ ...r, isStale: true }));
    } catch (e) { return []; }
  });
  const [fidelity, setFidelity] = useState('PRO LOSSLESS');
  const [elapsed, setElapsed] = useState(0);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(40));
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  
  const audioRef = useRef(null);
  const silentPlayerRef = useRef(null);
  const recorderRef = useRef(new OnyxRecorder());
  const rafRef = useRef(null);

  useEffect(() => {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTABAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    audio.loop = true;
    silentPlayerRef.current = audio;
  }, []);

  useEffect(() => {
    localStorage.setItem('onyx_signal_archive', JSON.stringify(recordings));
  }, [recordings]);

  const updateVisualizer = useCallback(() => {
    if (isRecording) {
      const data = recorderRef.current.getFrequencyData();
      const downsampled = new Uint8Array(40);
      for (let i = 0; i < 40; i++) downsampled[i] = data[i * Math.floor(data.length / 40)];
      setFrequencyData(downsampled);
      rafRef.current = requestAnimationFrame(updateVisualizer);
    }
  }, [isRecording]);

  const formatTime = (s) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => setElapsed(prev => prev + 1), 1000);
      updateVisualizer();
    } else {
      clearInterval(interval);
      cancelAnimationFrame(rafRef.current);
      setElapsed(0);
      setFrequencyData(new Uint8Array(40));
    }
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isRecording, updateVisualizer]);

  const handleRecord = async () => {
    triggerHaptic('medium');
    if (!isRecording) {
      try {
        if (silentPlayerRef.current) {
          silentPlayerRef.current.play().catch(e => console.error("Silent play failed", e));
        }
        await recorderRef.current.start(fidelity);
        setIsRecording(true);
      } catch (err) { console.error(err); }
    } else {
      const result = await recorderRef.current.stop();
      setIsRecording(false);
      silentPlayerRef.current?.pause();
      if (result.url) {
        const newRecord = {
          id: Date.now(),
          name: `SIG ${Math.floor(Math.random() * 999)}`,
          duration: elapsed,
          url: result.url,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          fidelity,
          isStale: false
        };
        setRecordings(prev => [newRecord, ...prev]);
      }
    }
  };

  const deleteRecord = (id) => {
    triggerHaptic('light');
    const recordToDelete = recordings.find(r => r.id === id);
    if (recordToDelete && recordToDelete.url && !recordToDelete.isStale) {
      URL.revokeObjectURL(recordToDelete.url);
    }
    setRecordings(prev => prev.filter(r => r.id !== id));
  };

  const playRecording = (record) => {
    if (record.isStale) {
      alert("SIGNAL ARCHIVED. Payload reset on refresh. Metadata preserved.");
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      if (currentlyPlaying === record.id) {
        setCurrentlyPlaying(null);
        return;
      }
    }
    const audio = new Audio(record.url);
    audioRef.current = audio;
    setCurrentlyPlaying(record.id);
    audio.play().catch(e => setCurrentlyPlaying(null));
    audio.onended = () => setCurrentlyPlaying(null);
  };

  const avgLevel = useMemo(() => isRecording ? frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length : 0, [frequencyData, isRecording]);

  return (
    <div className="h-[100dvh] bg-black text-white p-8 flex flex-col items-center font-['Outfit'] overflow-hidden selection:bg-onyx-purple/30 overscroll-none">
      
      {/* Premium Overlays */}
      <div className="fixed inset-0 pointer-events-none z-[500] opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      <div className="fixed inset-0 pointer-events-none z-[501] opacity-[0.02] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

      <header className="w-full max-w-lg flex justify-between items-start pt-8 mb-12 shrink-0">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-onyx-purple animate-pulse" />
            <span className="text-[10px] font-black text-onyx-purple uppercase tracking-[0.5em] opacity-60">Acoustic Signal</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">Onyx Recorder</h1>
        </div>
        <div className={cn("w-2 h-2 rounded-full transition-colors mt-2", isRecording ? "bg-onyx-purple shadow-[0_0_12px_rgba(192,132,252,0.8)]" : "bg-white/5")} />
      </header>

      <div className="w-full max-w-lg flex flex-col gap-8 mb-10 shrink-0">
        <div className="bg-[#0A0A0A] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-40 h-40 bg-onyx-purple/5 blur-3xl -mr-20 -mt-20 rounded-full" />
           <div className="flex justify-between items-start mb-8 relative z-10">
              <button 
                disabled={isRecording}
                onClick={() => { triggerHaptic(); setFidelity(f => f === 'PRO LOSSLESS' ? 'CORE VOICE' : 'PRO LOSSLESS'); }}
                className={cn("flex items-center gap-3 px-5 py-2.5 bg-black border rounded-2xl transition-all", isRecording ? "opacity-30 border-white/5" : "border-white/5 hover:border-onyx-purple/30")}
              >
                <Sliders size={12} className="text-onyx-purple" />
                <span className="text-[9px] font-black uppercase tracking-[0.4em]">{fidelity}</span>
              </button>
              <span className="text-[9px] font-mono text-zinc-800 uppercase tracking-[0.3em]">48.0 KHZ</span>
           </div>
           <div className="flex flex-col items-center py-6 relative z-10">
              <span className={cn("text-8xl font-mono font-black tracking-tighter tabular-nums leading-none transition-all", isRecording ? "text-white" : "text-white/5")}>{formatTime(elapsed)}</span>
              <div className="w-full mt-10"><VUStrip value={avgLevel} /></div>
           </div>
        </div>

        <div className="flex items-center justify-center">
           <motion.button
            onPointerDown={handleRecord}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "w-24 h-24 rounded-[2rem] flex items-center justify-center transition-all duration-500",
              isRecording ? "bg-onyx-purple shadow-[0_0_60px_rgba(192,132,252,0.4)]" : "bg-white/[0.03] border border-white/5 hover:border-onyx-purple/40"
            )}
          >
            {isRecording ? <Square size={28} className="text-white fill-current" /> : <TechnicalMic active={isRecording} />}
          </motion.button>
        </div>
      </div>

      <div className="w-full max-w-lg flex flex-col flex-1 min-h-0 pt-6">
        <div className="flex items-center gap-3 mb-8 px-2">
           <div className="w-12 h-[1px] bg-zinc-900" />
           <span className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em]">Archive Lattice</span>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-12 relative">
           <AnimatePresence mode="popLayout" initial={false}>
             {recordings.length === 0 ? (
               <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center opacity-10">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em]">Empty_Sector</span>
               </motion.div>
             ) : (
               <div className="flex flex-col gap-4">
                 {recordings.map((record) => (
                   <motion.div 
                     key={record.id}
                     layout
                     initial={{ opacity: 0, scale: 0.95, y: 20 }}
                     animate={{ opacity: record.isStale ? 0.3 : 1, scale: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.95, y: 20 }}
                     className={cn("bg-[#0A0A0A] border border-white/5 rounded-2xl p-5 flex items-center justify-between group hover:border-white/10 shadow-xl", record.isStale && "grayscale")}
                   >
                     <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                           <span className="text-sm font-black tracking-widest uppercase">{record.name}</span>
                           {record.isStale && <AlertTriangle size={12} className="text-zinc-800" />}
                        </div>
                        <div className="flex items-center gap-3 opacity-30 text-[9px] font-bold uppercase tracking-[0.3em]">
                           <span>{record.timestamp}</span>
                           <span className="w-1 h-1 bg-white/20 rounded-full" />
                           <span className="tabular-nums">{formatTime(record.duration)}</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <button onClick={() => playRecording(record)} className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-all", currentlyPlaying === record.id ? "bg-white text-black" : "bg-white/5 text-white/40 hover:bg-white/10")}>
                          {currentlyPlaying === record.id ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        </button>
                        <button onClick={() => deleteRecord(record.id)} className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-zinc-800 hover:text-red-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                     </div>
                   </motion.div>
                 ))}
               </div>
             )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
