import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Play, Trash2, Download, Settings, Database, Clock, Activity, Zap, Volume2, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { OnyxRecorder } from './utils/audio';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// --- Analog VU Meter Component ---
const VUMeter = ({ value, label }) => {
  // Map value (0-255) to rotation (-60 to 60 degrees)
  const rotation = (value / 255) * 120 - 60;
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-16 bg-zinc-900 border border-white/10 rounded-t-full overflow-hidden flex items-end justify-center pb-1 shadow-inner">
        {/* Scale */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-20 h-20 border-t border-white rounded-full mt-10" />
        </div>
        
        {/* The Needle */}
        <motion.div 
          animate={{ rotate: rotation }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="w-[1.5px] h-12 bg-onyx-purple origin-bottom mb-[-2px] relative z-10 shadow-[0_0_8px_rgba(192,132,252,0.5)]"
        />
        
        {/* Pivot Point */}
        <div className="w-2 h-2 bg-white rounded-full absolute bottom-[-4px] z-20 shadow-md" />
        
        {/* Background Labels */}
        <div className="absolute inset-x-2 bottom-4 flex justify-between text-[5px] font-black text-white/20 uppercase tracking-tighter">
          <span>-20</span>
          <span>-10</span>
          <span>-5</span>
          <span className="text-red-500/40">0dB</span>
        </div>
      </div>
      <span className="text-[7px] font-black text-onyx-muted uppercase tracking-[0.3em]">{label}</span>
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

  const updateVisualizer = () => {
    if (isRecording) {
      const data = recorderRef.current.getFrequencyData();
      const downsampled = new Uint8Array(40);
      for (let i = 0; i < 40; i++) downsampled[i] = data[i * Math.floor(data.length / 40)];
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
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const handleRecord = async () => {
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
        name: `SIGNAL-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
        duration: elapsed,
        url: result.url,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        fidelity
      };
      setRecordings(prev => [newRecord, ...prev]);
    }
  };

  const avgLevel = useMemo(() => {
    if (!isRecording) return 0;
    const sum = frequencyData.reduce((a, b) => a + b, 0);
    return sum / frequencyData.length;
  }, [frequencyData, isRecording]);

  return (
    <div className="h-[100dvh] bg-[#050505] text-white p-6 md:p-12 flex flex-col items-center font-['Outfit'] overflow-hidden selection:bg-onyx-purple/30">
      
      {/* Chassis: Industrial Top Bar */}
      <header className="w-full max-w-2xl flex justify-between items-end mb-12 px-4 pb-6 border-b border-white/5 relative">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-3">
             <div className="w-2 h-2 bg-onyx-purple rounded-full shadow-[0_0_10px_rgba(192,132,252,0.8)]" />
             <span className="text-[9px] font-black text-onyx-purple uppercase tracking-[0.5em]">Onyx Signal Alpha</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase leading-[0.8] italic">Acoustic<br/><span className="text-white/10">Machine</span></h1>
        </div>
        
        <div className="flex flex-col items-end">
           <span className="text-[8px] font-mono text-zinc-600 mb-1 uppercase tracking-widest">Serial // ONYX-SR-2026</span>
           <div className="flex gap-1">
              {[...Array(4)].map((_, i) => <div key={i} className="w-3 h-1 bg-white/5" />)}
              <div className="w-3 h-1 bg-onyx-purple/40" />
           </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl flex flex-col items-center">
        
        {/* The Analog Bridge: VU Meters and Tape Hub */}
        <div className="w-full bg-[#0A0A0A] border border-white/10 rounded-[40px] p-8 mb-12 shadow-2xl relative group overflow-hidden">
           {/* Subtle Grid Pattern Overlay */}
           <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
           
           <div className="flex justify-between items-center mb-10 relative z-10 px-4">
              <VUMeter value={avgLevel * 1.2} label="Input Gain" />
              
              {/* Rotating Tape Reel Visual */}
              <div className="relative">
                <motion.div 
                  animate={{ rotate: isRecording ? 360 : 0 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 rounded-full border-[3px] border-white/5 flex items-center justify-center relative"
                >
                  <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center">
                    <div className="w-1 h-8 bg-white/5 absolute rotate-45" />
                    <div className="w-1 h-8 bg-white/5 absolute -rotate-45" />
                    <div className="w-2 h-2 bg-onyx-purple rounded-full" />
                  </div>
                </motion.div>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-[6px] font-black text-zinc-600 uppercase tracking-widest">Reel 01A</span>
                </div>
              </div>

              <VUMeter value={avgLevel * 0.8} label="Bias Level" />
           </div>

           {/* The VFD (Vacuum Fluorescent Display) Timer */}
           <div className="w-full bg-black/80 border border-white/5 rounded-2xl py-6 flex flex-col items-center justify-center relative shadow-inner">
              <div className="absolute top-2 left-4 flex gap-1">
                <Zap className={cn("w-2 h-2", isRecording ? "text-yellow-500" : "text-white/5")} />
                <Activity className={cn("w-2 h-2", isRecording ? "text-onyx-purple" : "text-white/5")} />
              </div>
              
              <div className="flex items-baseline gap-1">
                <span className={cn(
                  "text-6xl font-mono font-black tracking-tighter tabular-nums transition-all duration-300",
                  isRecording ? "text-onyx-purple drop-shadow-[0_0_15px_rgba(192,132,252,0.6)]" : "text-white/10"
                )}>
                  {formatTime(elapsed)}
                </span>
                <span className="text-xs font-black text-white/20 uppercase tracking-widest italic">sec</span>
              </div>
              
              <div className="mt-2 flex gap-12 opacity-40">
                <div className="flex flex-col items-center">
                   <span className="text-[7px] font-black uppercase tracking-widest text-zinc-600">Sample Rate</span>
                   <span className="text-[9px] font-mono font-bold">48.0 KHZ</span>
                </div>
                <div className="flex flex-col items-center">
                   <span className="text-[7px] font-black uppercase tracking-widest text-zinc-600">Fidelity</span>
                   <span className="text-[9px] font-mono font-bold">HI-RES</span>
                </div>
              </div>
           </div>
        </div>

        {/* The "Big Red Button" Control Node */}
        <div className="relative mb-16 flex items-center gap-12">
           <div className="flex flex-col items-center opacity-30">
              <button className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center mb-2"><Volume2 size={12} /></button>
              <span className="text-[6px] font-black uppercase tracking-widest">Monitor</span>
           </div>

           <motion.button
            onPointerDown={handleRecord}
            whileTap={{ scale: 0.95, y: 4 }}
            className={cn(
              "w-28 h-28 rounded-[35%] flex items-center justify-center transition-all duration-500 relative z-10 border-b-[6px]",
              isRecording 
                ? "bg-red-600 border-red-800 shadow-[0_20px_40px_rgba(220,38,38,0.2)]" 
                : "bg-onyx-purple border-[#8B5CF6] shadow-[0_20px_40px_rgba(139,92,246,0.2)]"
            )}
          >
            <div className="absolute inset-1 rounded-[30%] border border-white/20 pointer-events-none" />
            {isRecording ? <Square className="w-8 h-8 text-white fill-current" /> : <Mic className="w-8 h-8 text-white fill-current" />}
          </motion.button>

          <div className="flex flex-col items-center opacity-30">
              <button className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center mb-2"><ShieldAlert size={12} /></button>
              <span className="text-[6px] font-black uppercase tracking-widest">Limit</span>
           </div>
        </div>

        {/* The Archive Ledger */}
        <div className="w-full flex-1 overflow-y-auto no-scrollbar pb-12">
           <div className="flex items-center gap-3 mb-8">
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.6em]">Archive Registry</span>
              <div className="h-[1px] flex-1 bg-white/5" />
           </div>
           
           <div className="grid grid-cols-1 gap-4">
              {recordings.length === 0 ? (
                <div className="py-12 border border-white/5 border-dashed rounded-3xl flex flex-col items-center justify-center opacity-20">
                   <Database size={24} className="mb-4" />
                   <span className="text-[8px] font-black uppercase tracking-widest">No Signals Recorded</span>
                </div>
              ) : (
                recordings.map((record, index) => (
                  <motion.div 
                    key={record.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex items-center justify-between group hover:border-onyx-purple/30 transition-all"
                  >
                    <div className="flex flex-col gap-1">
                       <div className="flex items-center gap-3">
                          <div className={cn("w-1 h-1 rounded-full", currentlyPlaying === record.id ? "bg-onyx-purple animate-pulse" : "bg-white/20")} />
                          <span className="text-xs font-black tracking-widest uppercase">{record.name}</span>
                       </div>
                       <div className="flex items-center gap-4 opacity-40 text-[8px] font-bold uppercase tracking-widest pl-4">
                          <span>{record.timestamp}</span>
                          <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                          <span className="tabular-nums">{formatTime(record.duration)}</span>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={() => playRecord(record.url, record.id)}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                          currentlyPlaying === record.id ? "bg-onyx-purple text-black" : "bg-white/5 text-white/40 hover:text-white"
                        )}
                       >
                         {currentlyPlaying === record.id ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                       </button>
                    </div>
                  </motion.div>
                ))
              )}
           </div>
        </div>
      </main>

      <footer className="w-full max-w-2xl mt-8 pt-8 border-t border-white/5 flex justify-between items-center opacity-30 grayscale hover:grayscale-0 transition-all">
         <div className="flex gap-6">
            <button className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest"><Settings size={12} /> Config</button>
            <button className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest"><Download size={12} /> Export</button>
         </div>
         <span className="text-[7px] font-mono tracking-widest">ONYX_SYS_ACTIVE_NODE_05</span>
      </footer>
    </div>
  );
}
