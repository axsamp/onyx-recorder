import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, Play, Trash2, Settings, Database, Clock, Sliders, AlertTriangle, Activity, X } from 'lucide-react';
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
    if (isRecording) {
      triggerHaptic('heavy');
      const { url } = await recorderRef.current.stop();
      const newRecord = {
        id: Date.now(),
        url,
        name: `Signal_${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
        timestamp: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        duration: elapsed,
        isStale: false
      };
      setRecordings(prev => [newRecord, ...prev]);
      setIsRecording(false);
      if (silentPlayerRef.current) silentPlayerRef.current.pause();
    } else {
      triggerHaptic('medium');
      const started = await recorderRef.current.start();
      if (started) {
        setIsRecording(true);
        if (silentPlayerRef.current) silentPlayerRef.current.play().catch(e => {});
      }
    }
  };

  const deleteRecord = (id) => {
    triggerHaptic('light');
    setRecordings(prev => prev.filter(r => r.id !== id));
  };

  const playRecording = (record) => {
    triggerHaptic('medium');
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
    <div className="h-[100dvh] bg-g-bg text-g-text p-6 flex flex-col items-center font-sans overflow-hidden selection:bg-g-primary-container overscroll-none">
      
      <header className="w-full max-w-lg flex justify-between items-start pt-12 mb-10 shrink-0 px-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-g-primary rounded-full animate-pulse" />
            <span className="text-[11px] font-bold text-g-primary uppercase tracking-widest">Acoustic Intel</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-g-text">Signal Recorder</h1>
        </div>
        <div className={cn("w-3 h-3 rounded-full transition-colors mt-2 shadow-elevation-1", isRecording ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]" : "bg-g-outline/30")} />
      </header>

      <div className="w-full max-w-lg flex flex-col gap-6 mb-8 shrink-0 px-2">
        <div className="material-card p-6 shadow-elevation-2 relative overflow-hidden bg-white">
           <div className="absolute top-0 right-0 w-48 h-48 bg-g-primary/5 blur-3xl -mr-24 -mt-24 rounded-full" />
           <div className="flex justify-between items-start mb-10 relative z-10">
              <button 
                disabled={isRecording}
                onClick={() => { triggerHaptic(); setFidelity(f => f === 'PRO LOSSLESS' ? 'CORE VOICE' : 'PRO LOSSLESS'); }}
                className={cn("flex items-center gap-2.5 px-4 py-2 bg-g-bg border rounded-xl transition-all shadow-sm ripple", isRecording ? "opacity-40 border-g-outline/20" : "border-g-outline/20 hover:border-g-primary/50 hover:bg-g-aluminium")}
              >
                <Sliders size={14} className="text-g-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-g-text">{fidelity}</span>
              </button>
              <div className="text-right">
                <span className="text-[10px] font-bold text-g-text-variant uppercase tracking-widest block">Sample Rate</span>
                <span className="text-xs font-bold text-g-primary tabular-nums">48.0 KHZ</span>
              </div>
           </div>
           <div className="flex flex-col items-center py-4 relative z-10">
              <span className={cn("text-7xl font-bold tracking-tighter tabular-nums leading-none transition-all", isRecording ? "text-g-text" : "text-g-outline")}>{formatTime(elapsed)}</span>
              <div className="w-full mt-10"><VUStrip value={avgLevel} /></div>
           </div>
        </div>

        <div className="flex items-center justify-center">
           <motion.button
            onPointerDown={handleRecord}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "w-24 h-24 rounded-3xl flex items-center justify-center transition-all duration-300 ripple shadow-elevation-2",
              isRecording ? "bg-red-500" : "bg-g-primary text-white"
            )}
          >
            {isRecording ? <Square size={32} className="fill-current" /> : <Play size={32} className="fill-current ml-1" />}
          </motion.button>
        </div>
      </div>

      <div className="w-full max-w-lg flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-6 px-4">
           <span className="text-[11px] font-bold text-g-text-variant uppercase tracking-widest">Signal Archive</span>
           <div className="h-[1px] flex-1 bg-g-outline/20 ml-4" />
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-20 px-2 relative">
           <AnimatePresence mode="popLayout" initial={false}>
             {recordings.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-g-aluminium flex items-center justify-center mb-4 opacity-40">
                    <Database size={24} className="text-g-text-variant" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-g-text-variant opacity-40">No signals captured</span>
                </motion.div>
             ) : (
                <div className="flex flex-col gap-3">
                  {recordings.map((record) => (
                    <motion.div 
                      key={record.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: record.isStale ? 0.6 : 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className={cn("material-card p-5 flex items-center justify-between group shadow-elevation-1 ripple", record.isStale && "bg-g-bg/50 border-dashed border-g-outline/30")}
                    >
                      <div className="flex flex-col gap-1.5">
                         <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-g-text">{record.name}</span>
                            {record.isStale && <AlertTriangle size={12} className="text-red-500" />}
                         </div>
                         <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-g-text-variant">
                            <span>{record.timestamp}</span>
                            <div className="w-1 h-1 bg-g-outline rounded-full" />
                            <span className="tabular-nums">{formatTime(record.duration)}</span>
                         </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <button onClick={() => playRecording(record)} className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-all ripple", currentlyPlaying === record.id ? "bg-g-primary text-white shadow-elevation-2" : "bg-g-aluminium text-g-text-variant hover:bg-g-outline/20")}>
                           {currentlyPlaying === record.id ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                         </button>
                         <button onClick={() => deleteRecord(record.id)} className="w-12 h-12 rounded-full bg-g-surface border border-g-outline/20 flex items-center justify-center text-g-text-variant hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-colors shadow-sm">
                           <Trash2 size={16} />
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
