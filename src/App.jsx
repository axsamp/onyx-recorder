import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Play, Trash2, Download, Settings, Database, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { OnyxRecorder } from './utils/audio';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const springConfig = { stiffness: 400, damping: 30, mass: 1 };

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

  // Audio Playback
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
    
    audio.play();
    audio.onended = () => setCurrentlyPlaying(null);
  };

  // Frequency Data Polling
  const updateVisualizer = () => {
    if (isRecording) {
      const data = recorderRef.current.getFrequencyData();
      // Downsample to 40 bars for the UI
      const downsampled = new Uint8Array(40);
      for (let i = 0; i < 40; i++) {
        downsampled[i] = data[i * Math.floor(data.length / 40)];
      }
      setFrequencyData(downsampled);
      rafRef.current = requestAnimationFrame(updateVisualizer);
    }
  };

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
  }, [isRecording]);

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const deleteRecord = (id) => {
    if (typeof window !== 'undefined' && window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }
    const updated = prev => prev.filter(r => r.id !== id);
    setRecordings(updated);
    // Note: We need the length of the filtered array
    setTimeout(() => {
      const current = JSON.parse(localStorage.getItem('onyx_signal_count') || '0');
      localStorage.setItem('onyx_signal_count', Math.max(0, current - 1).toString());
    }, 0);
  };

  const handleRecord = async () => {
    if (typeof window !== 'undefined' && window.navigator.vibrate) {
      window.navigator.vibrate(20);
    }

    if (!isRecording) {
      try {
        await recorderRef.current.start(fidelity);
        setIsRecording(true);
      } catch (err) {
        console.error("Failed to start recording:", err);
      }
    } else {
      const result = await recorderRef.current.stop();
      setIsRecording(false);
      
      const newRecord = {
        id: Date.now(),
        name: `SIG ${Math.floor(Math.random() * 999)}`,
        duration: elapsed,
        url: result.url,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        fidelity: fidelity
      };
      const updatedRecordings = [newRecord, ...recordings];
      setRecordings(updatedRecordings);
      localStorage.setItem('onyx_signal_count', updatedRecordings.length.toString());
    }
  };

  return (
    <div className="h-[100dvh] bg-black text-white p-6 md:p-12 flex flex-col items-center font-['Outfit'] overflow-hidden selection:bg-onyx-purple/30">
      
      {/* Chassis Branding */}
      <header className="w-full flex justify-between items-start mb-16 px-2 shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-onyx-purple uppercase tracking-[0.6em] mb-2 opacity-80">Onyx Signal</span>
          <h1 className="text-4xl font-black tracking-tighter uppercase leading-[0.8]">Acoustic<br/><span className="text-white/20">Archive</span></h1>
        </div>
        <div className="flex flex-col items-end pt-2">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-3 h-3 text-onyx-purple/60" />
            <span className="text-[7px] font-bold text-onyx-muted uppercase tracking-[0.3em]">Storage Lnk</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-white/40 tracking-tight">0.42 / 5.00 GB</span>
        </div>
      </header>

      {/* Main Signal Interface */}
      <main className="flex-1 w-full max-w-2xl flex flex-col items-center overflow-y-auto no-scrollbar pb-32">
        
        {/* The Oscilloscope Viewport */}
        <div className="w-full aspect-[2/1] bg-white/[0.02] border border-white/5 rounded-3xl relative overflow-hidden mb-12 group shrink-0">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
             {/* Simple visualizer mock */}
             <div className="w-full flex items-center justify-center gap-1 h-32 px-12">
               {[...Array(40)].map((_, i) => (
                 <motion.div 
                   key={i}
                   animate={{ 
                     height: isRecording ? Math.max(4, frequencyData[i] / 2) : 4 
                   }}
                   transition={{ type: "spring", stiffness: 300, damping: 20 }}
                   className="w-[2px] bg-onyx-purple rounded-full"
                 />
               ))}
             </div>
          </div>
          
          {/* Top-Edge Telemetry */}
          <div className="absolute top-4 left-6 flex items-center gap-4">
             <div className="flex items-center gap-2">
               <div className={cn("w-1.5 h-1.5 rounded-full", isRecording ? "bg-red-500 animate-pulse" : "bg-onyx-muted")} />
               <span className="text-[10px] font-bold tracking-widest uppercase">{isRecording ? "Capturing" : "Standby"}</span>
             </div>
             <span className="text-xl font-mono font-bold tracking-tighter tabular-nums">{formatTime(elapsed)}</span>
          </div>

          {/* Bottom-Edge Settings */}
          <div className="absolute bottom-4 right-6 flex items-center gap-4">
            <button 
              onClick={() => setFidelity(fidelity === 'PRO LOSSLESS' ? 'CORE MEMO' : 'PRO LOSSLESS')}
              className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[8px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
            >
              Mode: {fidelity}
            </button>
          </div>
        </div>

        {/* The Signal Core (Record Button) */}
        <div className="relative mb-20 shrink-0">
          <motion.button
            onPointerDown={handleRecord}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 relative z-10",
              isRecording ? "bg-red-500/10 border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.3)]" : "bg-onyx-purple/10 border-2 border-onyx-purple shadow-[0_0_40px_rgba(192,132,252,0.3)]"
            )}
          >
            {isRecording ? <Square className="w-8 h-8 text-red-500 fill-current" /> : <Mic className="w-8 h-8 text-onyx-purple fill-current" />}
          </motion.button>
          
          {/* Decorative Signal Rings */}
          <AnimatePresence>
            {isRecording && (
              <>
                <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 2, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 rounded-full border border-red-500" />
                <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 2.5, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} className="absolute inset-0 rounded-full border border-red-500/50" />
              </>
            )}
          </AnimatePresence>
        </div>

        {/* The Archive Lattice */}
        <div className="w-full shrink-0">
          <div className="flex items-center gap-3 mb-6">
             <span className="text-[10px] font-black text-onyx-muted uppercase tracking-[0.4em]">Signal Archive</span>
             <div className="h-[1px] flex-1 bg-white/5" />
          </div>

          <div className="relative">
             {/* Mini Backbone Line */}
             <div className="absolute left-0 top-0 bottom-0 w-[1.5px] bg-gradient-to-b from-onyx-purple/40 via-onyx-purple/10 to-transparent" />
             
             <div className="flex flex-col gap-8 pl-8">
                {recordings.length === 0 ? (
                  <p className="text-[10px] font-bold text-onyx-muted uppercase tracking-[0.6em] opacity-30 py-12">No signals archived.</p>
                ) : (
                  recordings.map((record, index) => (
                    <motion.div 
                      key={record.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative flex items-center justify-between group"
                    >
                      {/* Circuit Path */}
                      <svg className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-4 overflow-visible pointer-events-none">
                        <path d="M0 0 L18 0 L24 4" fill="none" stroke="#C084FC" strokeWidth="1" opacity="0.2" />
                        <rect x="-1.5" y="-1.5" width="3" height="3" fill="#C084FC" opacity="0.3" transform="rotate(45)" />
                      </svg>

                      <div className="flex flex-col gap-1">
                         <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-white tracking-tight uppercase">{record.name}</span>
                            <div className="h-[1px] w-4 bg-white/10" />
                            <span className="text-[7px] font-mono font-bold text-onyx-purple/60 tracking-widest">{record.fidelity}</span>
                         </div>
                         <div className="flex items-center gap-4 text-[9px] font-bold text-white/30 uppercase tracking-[0.2em]">
                            <div className="flex items-center gap-1.5"><Clock className="w-2.5 h-2.5 opacity-50" /> {record.timestamp}</div>
                            <div className="tabular-nums">{formatTime(record.duration)}</div>
                         </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-100 transition-all duration-300">
                        <button 
                          onClick={() => playRecord(record.url, record.id)}
                          className={cn("p-2 transition-colors", currentlyPlaying === record.id ? "text-onyx-purple" : "text-white/40 hover:text-onyx-purple")}
                        >
                          {currentlyPlaying === record.id ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                        </button>
                        <button 
                          onClick={() => deleteRecord(record.id)}
                          className="p-2 text-white/20 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
             </div>
          </div>
        </div>
      </main>

      {/* Settings Footer */}
      <footer className="mt-12 flex items-center gap-8 text-[9px] font-bold text-onyx-muted uppercase tracking-[0.4em]">
         <button className="hover:text-white transition-colors flex items-center gap-2"><Settings className="w-3 h-3" /> Config</button>
         <button className="hover:text-white transition-colors flex items-center gap-2"><Download className="w-3 h-3" /> Bulk Export</button>
      </footer>
    </div>
  );
}
