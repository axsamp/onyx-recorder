import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, Play, Trash2, Download, Settings, Database, Clock, Sliders, ChevronDown } from 'lucide-react';
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
    {active && <circle cx="12" cy="9" r="1.2" fill="#C084FC" className="opacity-80 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />}
  </svg>
);

const VUStrip = ({ value }) => {
  const level = (value / 255) * 100;
  return (
    <div className="w-full flex flex-col gap-1 px-4">
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden relative">
        <motion.div 
          animate={{ width: `${level}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={cn("h-full transition-colors duration-300", level > 90 ? "bg-onyx-purple" : "bg-onyx-purple/40")}
        />
      </div>
    </div>
  );
};

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [fidelity, setFidelity] = useState('PRO LOSSLESS');
  const [elapsed, setElapsed] = useState(0);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(40));
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  
  const audioRef = useRef(null);
  const silentPlayerRef = useRef(null); // For Dynamic Island Hack
  const timerRef = useRef(null);
  const recorderRef = useRef(new OnyxRecorder());
  const rafRef = useRef(null);

  // Initialize Silent Player for iOS Dynamic Island support
  useEffect(() => {
    const audio = new Audio();
    // 1-second silent base64 mp3
    audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
    audio.loop = true;
    silentPlayerRef.current = audio;
  }, []);

  const playRecord = (url, id) => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (currentlyPlaying === id) {
        setCurrentlyPlaying(null);
        return;
      }
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    setCurrentlyPlaying(id);
    audio.play().catch(e => setCurrentlyPlaying(null));
    audio.onended = () => setCurrentlyPlaying(null);
  };

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

  // Dynamic Island / Media Session Update
  useEffect(() => {
    if (isRecording && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: `ONYX SIGNAL: RECORDING`,
        artist: `Elapsed: ${formatTime(elapsed)}`,
        album: `Fidelity: ${fidelity}`,
        artwork: [{ src: 'https://axsamp.github.io/onyx-hub/apple-touch-icon.png', sizes: '512x512', type: 'image/png' }]
      });
    }
  }, [isRecording, elapsed, fidelity]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
      updateVisualizer();
      silentPlayerRef.current?.play().catch(() => {}); // Start silent loop for iOS backgrounding
    } else {
      clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      setElapsed(0);
      setFrequencyData(new Uint8Array(40));
      silentPlayerRef.current?.pause();
      if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
    }
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      silentPlayerRef.current?.pause();
    };
  }, [isRecording, updateVisualizer]);

  const handleRecord = async () => {
    triggerHaptic('medium');
    if (!isRecording) {
      try {
        await recorderRef.current.start(fidelity);
        setIsRecording(true);
      } catch (err) { console.error(err); }
    } else {
      const result = await recorderRef.current.stop();
      setIsRecording(false);
      if (!result.url) return;
      
      const newRecord = {
        id: Date.now(),
        name: `SIG ${Math.floor(Math.random() * 999)}`,
        duration: elapsed,
        url: result.url,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        fidelity
      };
      setRecordings(prev => [newRecord, ...prev]);
    }
  };

  const deleteRecord = (id) => {
    triggerHaptic('light');
    setRecordings(prev => prev.filter(r => r.id !== id));
  };

  const avgLevel = useMemo(() => {
    if (!isRecording) return 0;
    return frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length;
  }, [frequencyData, isRecording]);

  return (
    <div className="h-[100dvh] bg-black text-white p-6 flex flex-col items-center font-['Outfit'] overflow-hidden selection:bg-onyx-purple/30">
      <header className="w-full max-w-lg flex justify-between items-center py-4 mb-8 shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-onyx-purple uppercase tracking-[0.6em] mb-1">Onyx Signal</span>
          <h1 className="text-xl font-black tracking-tighter uppercase leading-[0.8] text-white/40">Acoustic</h1>
        </div>
        <div className="flex items-center gap-4">
           <span className="text-[8px] font-mono text-zinc-700 tracking-widest uppercase">Node 05</span>
           <div className={cn("w-1.5 h-1.5 rounded-full transition-colors duration-500", isRecording ? "bg-onyx-purple shadow-[0_0_8px_rgba(192,132,252,0.6)]" : "bg-white/5")} />
        </div>
      </header>

      <div className="w-full max-w-lg flex flex-col gap-6 mb-8 shrink-0">
        <div className="bg-[#080808] border border-white/5 rounded-3xl p-6 shadow-2xl relative">
           <div className="flex justify-between items-start mb-6">
              <button 
                disabled={isRecording}
                onClick={() => { triggerHaptic(); setFidelity(f => f === 'PRO LOSSLESS' ? 'CORE VOICE' : 'PRO LOSSLESS'); }}
                className={cn("flex items-center gap-3 px-4 py-2 bg-black border rounded-xl transition-all", isRecording ? "opacity-30 border-white/5 cursor-not-allowed" : "border-white/5 hover:border-onyx-purple/30")}
              >
                <Sliders size={10} className="text-onyx-purple" />
                <span className="text-[8px] font-black uppercase tracking-[0.3em]">{fidelity}</span>
              </button>
              <div className="flex flex-col items-end opacity-20">
                 <span className="text-[6px] font-black uppercase tracking-widest">Buffer Sync</span>
                 <span className="text-[8px] font-mono">48.0k</span>
              </div>
           </div>
           <div className="flex flex-col items-center py-4">
              <span className={cn("text-7xl font-mono font-black tracking-tighter tabular-nums leading-none transition-all duration-700", isRecording ? "text-white" : "text-white/5")}>{formatTime(elapsed)}</span>
              <div className="w-full mt-8"><VUStrip value={avgLevel} /></div>
           </div>
        </div>

        <div className="flex items-center justify-between px-2">
           <div className="flex flex-col items-center gap-1 opacity-20"><span className="text-[6px] font-black uppercase tracking-widest">In Gain</span><div className="w-8 h-[1px] bg-white/20" /></div>
           <motion.button onPointerDown={handleRecord} whileTap={{ scale: 0.95 }} className={cn("w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500 relative", isRecording ? "bg-onyx-purple border border-white/20 shadow-[0_0_40px_rgba(192,132,252,0.3)]" : "bg-white/[0.03] border border-white/10 hover:border-onyx-purple/40")}>
            {isRecording ? <Square size={24} className="text-white fill-current" /> : <TechnicalMic active={isRecording} />}
            {isRecording && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 rounded-2xl border-2 border-onyx-purple/30" />}
          </motion.button>
           <div className="flex flex-col items-center gap-1 opacity-20"><span className="text-[6px] font-black uppercase tracking-widest">Out Bias</span><div className="w-8 h-[1px] bg-white/20" /></div>
        </div>
      </div>

      <div className="w-full max-w-lg flex flex-col flex-1 min-h-0 border-t border-white/5 pt-6">
        <div className="flex items-center justify-between mb-4 px-2">
           <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.5em]">Archive Lattice</span>
           <span className="text-[9px] font-mono text-zinc-800">{recordings.length} Nodes</span>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-12">
           <AnimatePresence initial={false} mode="popLayout">
             {recordings.length === 0 ? (
               <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-20 flex flex-col items-center justify-center opacity-10 border border-dashed border-white/5 rounded-2xl">
                  <span className="text-[8px] font-black uppercase tracking-[0.3em]">No Archival Data</span>
               </motion.div>
             ) : (
               recordings.map((record) => (
                 <motion.div 
                   key={record.id}
                   layout
                   initial={{ opacity: 0, scale: 0.95, y: -20 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.95, x: -20 }}
                   transition={{ type: "spring", stiffness: 400, damping: 30 }}
                   className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-white/10 transition-all"
                 >
                   <div className="flex flex-col gap-1">
                      <span className="text-xs font-black tracking-widest uppercase">{record.name}</span>
                      <div className="flex items-center gap-3 opacity-30 text-[8px] font-bold uppercase tracking-widest">
                         <span>{record.timestamp}</span>
                         <span className="w-1 h-1 bg-white/40 rounded-full" />
                         <span className="tabular-nums">{formatTime(record.duration)}</span>
                         <span className="w-1 h-1 bg-white/40 rounded-full" />
                         <span className="text-onyx-purple">{record.fidelity.split(' ')[0]}</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <button onClick={() => playRecord(record.url, record.id)} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", currentlyPlaying === record.id ? "bg-white text-black" : "bg-white/5 text-white/40 hover:text-white")}>
                        {currentlyPlaying === record.id ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                      </button>
                      <button onClick={() => deleteRecord(record.id)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-800 hover:text-red-500 transition-all">
                        <Trash2 size={16} />
                      </button>
                   </div>
                 </motion.div>
               ))
             )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
