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
    <rect x="9" y="4" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" strokeOpacity={active ? 1 : 0.8} />
    <path d="M5 10C5 13.866 8.13401 17 12 17C15.866 17 19 13.866 19 10" stroke="currentColor" strokeWidth="1.5" strokeOpacity={active ? 1 : 0.5} />
    <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeOpacity={active ? 1 : 0.5} />
    <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="1.5" strokeOpacity={active ? 1 : 0.5} />
    {active && <circle cx="12" cy="9" r="1.2" fill="#E53935" className="opacity-100" />}
  </svg>
);

const VUStrip = ({ value }) => {
  const level = (value / 255) * 100;
  return (
    <div className="w-full px-4">
      <div className="h-2 w-full bg-g-aluminium rounded-full overflow-hidden">
        <motion.div animate={{ width: `${level}%` }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className={cn("h-full", level > 90 ? "bg-red-500" : "bg-g-primary")} />
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
    <div className="h-[100dvh] bg-g-bg text-g-text p-8 flex flex-col items-center font-sans overflow-hidden selection:bg-g-primary-container overscroll-none">
      
      <header className="w-full max-w-lg flex justify-between items-start pt-8 mb-12 shrink-0">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-g-primary rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-g-primary uppercase tracking-[0.2em]">Acoustic Signal</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight uppercase leading-none text-g-text">Signal Recorder</h1>
        </div>
        <div className={cn("w-2.5 h-2.5 rounded-full transition-colors mt-2 shadow-elevation-1", isRecording ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-g-outline/30")} />
      </header>

      <div className="w-full max-w-lg flex flex-col gap-8 mb-10 shrink-0">
        <div className="material-card p-8 shadow-elevation-2 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-40 h-40 bg-g-primary/5 blur-3xl -mr-20 -mt-20 rounded-full" />
           <div className="flex justify-between items-start mb-8 relative z-10">
              <button 
                disabled={isRecording}
                onClick={() => { triggerHaptic(); setFidelity(f => f === 'PRO LOSSLESS' ? 'CORE VOICE' : 'PRO LOSSLESS'); }}
                className={cn("flex items-center gap-3 px-5 py-2.5 bg-g-surface border rounded-2xl transition-all shadow-sm ripple", isRecording ? "opacity-40 border-g-outline/20" : "border-g-outline/20 hover:border-g-primary/50 hover:bg-g-aluminium")}
              >
                <Sliders size={14} className="text-g-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-g-text">{fidelity}</span>
              </button>
              <span className="text-[10px] font-mono font-bold text-g-text-variant uppercase tracking-[0.2em] pt-2">48.0 KHZ</span>
           </div>
           <div className="flex flex-col items-center py-6 relative z-10">
              <span className={cn("text-7xl font-mono font-bold tracking-tight tabular-nums leading-none transition-all", isRecording ? "text-g-text" : "text-g-outline")}>{formatTime(elapsed)}</span>
              <div className="w-full mt-10"><VUStrip value={avgLevel} /></div>
           </div>
        </div>

        <div className="flex items-center justify-center">
           <motion.button
            onPointerDown={handleRecord}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ripple",
              isRecording ? "bg-red-500 shadow-elevation-3" : "bg-white border-2 border-g-outline/20 shadow-elevation-1 hover:border-g-primary/30"
            )}
          >
            {isRecording ? <Square size={32} className="text-white fill-current" /> : <div className="text-g-primary"><TechnicalMic active={isRecording} /></div>}
          </motion.button>
        </div>
      </div>

      <div className="w-full max-w-lg flex flex-col flex-1 min-h-0 pt-6">
        <div className="flex items-center gap-3 mb-6 px-2">
           <div className="w-12 h-[1px] bg-g-outline/50" />
           <span className="text-[11px] font-bold text-g-text-variant uppercase tracking-[0.2em]">Archive Lattice</span>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-12 relative">
           <AnimatePresence mode="popLayout" initial={false}>
             {recordings.length === 0 ? (
               <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-g-text-variant">No recordings yet</span>
               </motion.div>
             ) : (
               <div className="flex flex-col gap-4">
                 {recordings.map((record) => (
                   <motion.div 
                     key={record.id}
                     layout
                     initial={{ opacity: 0, scale: 0.95, y: 20 }}
                     animate={{ opacity: record.isStale ? 0.5 : 1, scale: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.95, y: 20 }}
                     className={cn("material-card p-5 flex items-center justify-between group shadow-elevation-1 ripple", record.isStale && "bg-g-bg/50 border-dashed border-g-outline/30")}
                   >
                     <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                           <span className="text-sm font-bold tracking-wider uppercase text-g-text">{record.name}</span>
                           {record.isStale && <AlertTriangle size={14} className="text-red-500" />}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-g-text-variant">
                           <span>{record.timestamp}</span>
                           <span className="w-1 h-1 bg-g-outline rounded-full" />
                           <span className="tabular-nums">{formatTime(record.duration)}</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <button onClick={() => playRecording(record)} className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-all ripple", currentlyPlaying === record.id ? "bg-g-primary text-white shadow-elevation-2" : "bg-g-aluminium text-g-text-variant hover:bg-g-outline/20")}>
                          {currentlyPlaying === record.id ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                        </button>
                        <button onClick={() => deleteRecord(record.id)} className="w-12 h-12 rounded-full bg-g-surface border border-g-outline/20 flex items-center justify-center text-g-text-variant hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-colors">
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
