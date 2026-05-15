import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Play, Trash2, Download, Settings, Database, Clock, Activity, Zap, Volume2, ShieldAlert, Sliders } from 'lucide-react';
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

// --- Minimalist Analog VU Strip ---
const VUStrip = ({ value }) => {
  const level = (value / 255) * 100;
  return (
    <div className="w-full flex flex-col gap-1.5 px-2">
      <div className="flex justify-between items-center text-[7px] font-black text-zinc-600 uppercase tracking-[0.3em]">
        <span>Signal Input</span>
        <span>{level.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
        <motion.div 
          animate={{ width: `${level}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={cn(
            "h-full rounded-full transition-colors duration-300",
            level > 85 ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-onyx-purple shadow-[0_0_10px_rgba(192,132,252,0.5)]"
          )}
        />
        {/* Scale Ticks */}
        <div className="absolute inset-0 flex justify-between px-4 pointer-events-none opacity-20">
          {[...Array(5)].map((_, i) => <div key={i} className="w-[1px] h-full bg-black" />)}
        </div>
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
  const timerRef = useRef(null);
  const recorderRef = useRef(new OnyxRecorder());
  const rafRef = useRef(null);

  // Playback logic
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

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
      updateVisualizer();
    } else {
      clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      setElapsed(0);
      setFrequencyData(new Uint8Array(40));
    }
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isRecording, updateVisualizer]);

  const formatTime = (s) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

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

  const toggleFidelity = () => {
    triggerHaptic('light');
    setFidelity(prev => prev === 'PRO LOSSLESS' ? 'CORE VOICE' : 'PRO LOSSLESS');
  };

  const avgLevel = useMemo(() => {
    if (!isRecording) return 0;
    return frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length;
  }, [frequencyData, isRecording]);

  return (
    <div className="h-[100dvh] bg-black text-white p-6 md:p-12 flex flex-col items-center font-['Outfit'] overflow-hidden selection:bg-onyx-purple/30">
      
      {/* Minimalist Top Nav */}
      <header className="w-full max-w-lg flex justify-between items-center mb-16 pt-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-onyx-purple uppercase tracking-[0.6em] mb-1">Onyx Signal</span>
          <h1 className="text-2xl font-black tracking-tighter uppercase leading-[0.8] text-white/40 italic">Acoustic</h1>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end">
              <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">Sys_Status</span>
              <div className={cn("w-1.5 h-1.5 rounded-full mt-1 shadow-lg", isRecording ? "bg-red-500 animate-pulse shadow-red-500/50" : "bg-white/10")} />
           </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg flex flex-col items-center">
        
        {/* The Minimal Analog Display */}
        <div className="w-full bg-[#080808] border border-white/5 rounded-[32px] p-8 mb-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
           
           {/* Fidelity Mode Toggle */}
           <div className="flex justify-center mb-8">
              <button 
                onClick={toggleFidelity}
                className="group relative flex items-center gap-3 px-6 py-2.5 bg-black border border-white/10 rounded-full transition-all hover:border-onyx-purple/50"
              >
                <Sliders size={12} className={cn("transition-colors", fidelity === 'PRO LOSSLESS' ? "text-onyx-purple" : "text-zinc-600")} />
                <span className="text-[9px] font-black uppercase tracking-[0.4em] transition-colors">
                  {fidelity}
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-onyx-purple/20 group-hover:bg-onyx-purple transition-colors" />
              </button>
           </div>

           {/* The VFD Display */}
           <div className="flex flex-col items-center mb-10">
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-7xl font-mono font-black tracking-tighter tabular-nums transition-all duration-500",
                  isRecording ? "text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" : "text-white/10"
                )}>
                  {formatTime(elapsed)}
                </span>
                <span className="text-xs font-black text-white/20 uppercase tracking-widest">jst</span>
              </div>
           </div>

           {/* Signal Strip */}
           <VUStrip value={avgLevel} />
        </div>

        {/* Tactile Control Panel */}
        <div className="relative mb-16 w-full flex justify-center">
           <motion.button
            onPointerDown={handleRecord}
            whileTap={{ scale: 0.94 }}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 relative",
              isRecording 
                ? "bg-red-500 shadow-[0_0_50px_rgba(239,68,68,0.4)]" 
                : "bg-onyx-purple shadow-[0_0_50px_rgba(192,132,252,0.3)]"
            )}
          >
            {/* Minimal Inner Glow */}
            <div className="absolute inset-2 rounded-full border border-white/10" />
            {isRecording ? <Square size={32} className="text-white fill-current" /> : <Mic size={32} className="text-white fill-current" />}
          </motion.button>
        </div>

        {/* The Archive Lattice */}
        <div className="w-full flex-1 overflow-y-auto no-scrollbar">
           <div className="flex items-center gap-3 mb-6 px-2">
              <span className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em]">Signals</span>
              <div className="h-[1px] flex-1 bg-white/5" />
           </div>
           
           <div className="flex flex-col gap-3">
              {recordings.length === 0 ? (
                <div className="py-12 border border-white/5 border-dashed rounded-3xl flex flex-col items-center justify-center opacity-10">
                   <span className="text-[8px] font-black uppercase tracking-widest">Archives Empty</span>
                </div>
              ) : (
                recordings.map((record, index) => (
                  <motion.div 
                    key={record.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex items-center justify-between group hover:border-onyx-purple/20 transition-all"
                  >
                    <div className="flex flex-col gap-1">
                       <span className="text-xs font-black tracking-[0.1em] uppercase">{record.name}</span>
                       <div className="flex items-center gap-3 opacity-30 text-[8px] font-bold uppercase tracking-widest">
                          <span>{record.timestamp}</span>
                          <span className="w-1 h-1 bg-white/50 rounded-full" />
                          <span>{record.fidelity}</span>
                          <span className="w-1 h-1 bg-white/50 rounded-full" />
                          <span className="tabular-nums">{formatTime(record.duration)}</span>
                       </div>
                    </div>
                    
                    <button 
                      onClick={() => playRecord(record.url, record.id)}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        currentlyPlaying === record.id ? "bg-onyx-purple text-black" : "bg-white/5 text-white/20 hover:text-white"
                      )}
                    >
                      {currentlyPlaying === record.id ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    </button>
                  </motion.div>
                ))
              )}
           </div>
        </div>
      </main>

      <footer className="w-full max-w-lg mt-8 pt-8 border-t border-white/5 flex justify-between items-center opacity-20">
         <div className="flex gap-6">
            <button className="text-[8px] font-black uppercase tracking-widest hover:text-white transition-colors">Config</button>
            <button className="text-[8px] font-black uppercase tracking-widest hover:text-white transition-colors">Export</button>
         </div>
         <span className="text-[7px] font-mono tracking-widest">ONYX_V2.0_M</span>
      </footer>
    </div>
  );
}
