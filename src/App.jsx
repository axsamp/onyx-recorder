import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, Play, Trash2, Download, Settings, Database, Clock, Sliders } from 'lucide-react';
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
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div animate={{ width: `${level}%` }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className={cn("h-full", level > 90 ? "bg-onyx-purple" : "bg-onyx-purple/40")} />
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
  const silentPlayerRef = useRef(null);
  const recorderRef = useRef(new OnyxRecorder());
  const rafRef = useRef(null);

  useEffect(() => {
    const audio = new Audio();
    // 1-second silent WAV
    audio.src = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTABAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    audio.loop = true;
    silentPlayerRef.current = audio;
  }, []);

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

  // Handle Media Session Updates separately to avoid infinite loops
  useEffect(() => {
    if (isRecording && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: `REC: ${formatTime(elapsed)}`,
        artist: `ONYX SIGNAL // ${fidelity}`,
        artwork: [{ src: 'https://axsamp.github.io/onyx-hub/apple-touch-icon.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.playbackState = 'playing';
    } else if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  }, [isRecording, elapsed, fidelity]);

  const handleRecord = async () => {
    triggerHaptic('medium');
    if (!isRecording) {
      try {
        // iOS requires audio play within a user gesture
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
        setRecordings(prev => [{
          id: Date.now(),
          name: `SIG ${Math.floor(Math.random() * 999)}`,
          duration: elapsed,
          url: result.url,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          fidelity
        }, ...prev]);
      }
    }
  };

  const deleteRecord = (id) => {
    triggerHaptic('light');
    setRecordings(prev => prev.filter(r => r.id !== id));
  };

  const avgLevel = useMemo(() => isRecording ? frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length : 0, [frequencyData, isRecording]);

  return (
    <div className="h-[100dvh] bg-black text-white p-6 flex flex-col items-center font-['Outfit'] overflow-hidden">
      <header className="w-full max-w-lg flex justify-between items-center py-4 mb-8 shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-onyx-purple uppercase tracking-[0.6em] mb-1">Onyx Signal</span>
          <h1 className="text-xl font-black tracking-tighter uppercase leading-[0.8] text-white/40">Acoustic</h1>
        </div>
        <div className={cn("w-1.5 h-1.5 rounded-full", isRecording ? "bg-onyx-purple shadow-[0_0_8px_rgba(192,132,252,0.6)]" : "bg-white/5")} />
      </header>

      <div className="w-full max-w-lg flex flex-col gap-6 mb-8 shrink-0">
        <div className="bg-[#080808] border border-white/5 rounded-3xl p-6 shadow-2xl">
           <div className="flex justify-between items-start mb-6">
              <button 
                disabled={isRecording}
                onClick={() => { triggerHaptic(); setFidelity(f => f === 'PRO LOSSLESS' ? 'CORE VOICE' : 'PRO LOSSLESS'); }}
                className={cn("flex items-center gap-3 px-4 py-2 bg-black border rounded-xl transition-all", isRecording ? "opacity-30 border-white/5" : "border-white/5 hover:border-onyx-purple/30")}
              >
                <Sliders size={10} className="text-onyx-purple" />
                <span className="text-[8px] font-black uppercase tracking-[0.3em]">{fidelity}</span>
              </button>
              <span className="text-[8px] font-mono text-zinc-800 uppercase tracking-widest">48.0k</span>
           </div>
           <div className="flex flex-col items-center py-4">
              <span className={cn("text-7xl font-mono font-black tracking-tighter tabular-nums leading-none transition-all", isRecording ? "text-white" : "text-white/5")}>{formatTime(elapsed)}</span>
              <div className="w-full mt-8"><VUStrip value={avgLevel} /></div>
           </div>
        </div>

        <div className="flex items-center justify-center">
           <motion.button
            onPointerDown={handleRecord}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300",
              isRecording ? "bg-onyx-purple shadow-[0_0_40px_rgba(192,132,252,0.3)]" : "bg-white/[0.03] border border-white/10 hover:border-onyx-purple/40"
            )}
          >
            {isRecording ? <Square size={24} className="text-white fill-current" /> : <TechnicalMic active={isRecording} />}
          </motion.button>
        </div>
      </div>

      <div className="w-full max-w-lg flex flex-col flex-1 min-h-0 border-t border-white/5 pt-6">
        <div className="flex items-center justify-between mb-4 px-2">
           <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.5em]">Archive Lattice</span>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-12 relative">
           <AnimatePresence mode="popLayout" initial={false}>
             {recordings.length === 0 ? (
               <motion.div 
                 key="empty" 
                 initial={{ opacity: 0 }} 
                 animate={{ opacity: 1 }} 
                 exit={{ opacity: 0 }} 
                 className="absolute inset-0 flex flex-col items-center justify-center opacity-10"
               >
                  <span className="text-[8px] font-black uppercase tracking-[0.3em]">No Archival Data</span>
               </motion.div>
             ) : (
               <div className="flex flex-col gap-3">
                 {recordings.map((record) => (
                   <motion.div 
                     key={record.id}
                     layout
                     initial={{ opacity: 0, scale: 0.9, y: 20 }}
                     animate={{ opacity: 1, scale: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.9, y: 20 }}
                     transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.8 }}
                     className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-white/10"
                   >
                     <div className="flex flex-col gap-1">
                        <span className="text-xs font-black tracking-widest uppercase">{record.name}</span>
                        <div className="flex items-center gap-3 opacity-30 text-[8px] font-bold uppercase tracking-widest">
                           <span>{record.timestamp}</span>
                           <span className="w-1 h-1 bg-white/40 rounded-full" />
                           <span className="tabular-nums">{formatTime(record.duration)}</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            if (audioRef.current) {
                              audioRef.current.pause();
                              if (currentlyPlaying === record.id) { setCurrentlyPlaying(null); return; }
                            }
                            const audio = new Audio(record.url);
                            audioRef.current = audio;
                            setCurrentlyPlaying(record.id);
                            audio.play().catch(e => setCurrentlyPlaying(null));
                            audio.onended = () => setCurrentlyPlaying(null);
                          }} 
                          className={cn("w-10 h-10 rounded-xl flex items-center justify-center", currentlyPlaying === record.id ? "bg-white text-black" : "bg-white/5 text-white/40")}
                        >
                          {currentlyPlaying === record.id ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                        </button>
                        <button onClick={() => deleteRecord(record.id)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-800 hover:text-red-500">
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
