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

const CanvasWaveform = ({ isRecording, history }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    const render = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      
      if (canvas.width !== width * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const centerY = height / 2;
      const barWidth = 3;
      const gap = 2.5;
      const maxBars = Math.floor(width / (barWidth + gap));
      
      // We only draw the last 'maxBars' samples
      const samples = history.current.slice(-maxBars);
      
      // Dynamically load active CSS primary theme color for real-time styling
      const activePrimary = getComputedStyle(document.documentElement).getPropertyValue('--theme-g-primary').trim() || '#0B57D0';
      ctx.fillStyle = activePrimary;
      
      samples.forEach((amplitude, i) => {
        const x = width - (samples.length - i) * (barWidth + gap);
        // Normalize amplitude (0-255 range where 128 is center)
        const magnitude = Math.abs(amplitude - 128);
        const barHeight = Math.max(3, (magnitude / 64) * centerY);
        
        // Draw mirrored vertical bar
        const r = 1.5; // corner radius
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, r);
        ctx.fill();
      });

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (isRecording) {
        requestAnimationFrame(render);
      }
    };

    if (isRecording) {
      render();
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [isRecording, history]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-24 mt-4 rounded-2xl bg-g-bg/35 dark:bg-g-bg/20 border border-g-outline/10"
      style={{ display: 'block' }}
    />
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
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [isStealthMode, setIsStealthMode] = useState(() => localStorage.getItem('onyx_stealth_mode') === 'true');
  const [time, setTime] = useState(new Date());
  
  const audioRef = useRef(null);
  const silentPlayerRef = useRef(null);
  const recorderRef = useRef(new OnyxRecorder());
  const rafRef = useRef(null);
  const waveformHistory = useRef([]);

  // Dynamic Stealth/Dark Theme Synchronization
  useEffect(() => {
    const applyTheme = () => {
      const isDark = localStorage.getItem('onyx_stealth_mode') === 'true';
      setIsStealthMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    const handleStorage = (e) => {
      if (e.key === 'onyx_stealth_mode') {
        applyTheme();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0; // Perfectly silent
      osc.connect(gain);
      gain.connect(dest);
      osc.start();

      const audio = new Audio();
      audio.srcObject = dest.stream;
      silentPlayerRef.current = audio;
    } catch (e) {
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTABAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      audio.loop = true;
      silentPlayerRef.current = audio;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('onyx_signal_archive', JSON.stringify(recordings));
    localStorage.setItem('onyx_signal_count', recordings.length.toString());
  }, [recordings]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Acoustic Intel',
        artist: 'Onyx Protocol Signal',
      });
      navigator.mediaSession.setActionHandler('play', () => {});
      navigator.mediaSession.setActionHandler('pause', () => {});
    }
  }, []);

  const updateVisualizer = useCallback(() => {
    if (isRecording) {
      const data = recorderRef.current.getTimeDomainData();
      let max = 128;
      for (let i = 0; i < data.length; i++) {
        if (Math.abs(data[i] - 128) > Math.abs(max - 128)) {
          max = data[i];
        }
      }
      
      waveformHistory.current.push(max);
      if (waveformHistory.current.length > 1000) {
        waveformHistory.current.shift();
      }

      rafRef.current = requestAnimationFrame(updateVisualizer);
    }
  }, [isRecording]);

  const formatTime = (s) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const tokyoTime = useMemo(() => {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(time);
  }, [time]);

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => setElapsed(prev => prev + 1), 1000);
      updateVisualizer();
    } else {
      clearInterval(interval);
      cancelAnimationFrame(rafRef.current);
      setElapsed(0);
      waveformHistory.current = [];
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
      if (url) {
        const newRecord = {
          id: Date.now(),
          url,
          name: `Signal_${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
          timestamp: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          duration: elapsed,
          isStale: false
        };
        setRecordings(prev => [newRecord, ...prev]);
      }
      setIsRecording(false);
      if (silentPlayerRef.current) silentPlayerRef.current.pause();
    } else {
      triggerHaptic('medium');
      if (silentPlayerRef.current) silentPlayerRef.current.play().catch(e => {});
      
      const started = await recorderRef.current.start();
      if (started) {
        setIsRecording(true);
      } else {
        if (silentPlayerRef.current) silentPlayerRef.current.pause();
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

  return (
    <div className="h-[100dvh] bg-g-bg text-g-text p-6 flex flex-col items-center font-sans overflow-hidden selection:bg-g-primary-container overscroll-none transition-colors duration-700">
      
      {/* Dynamic Island Safety Spacer */}
      <div className="h-10 w-full shrink-0"></div>

      {/* M3 Expressive Header */}
      <header className="w-full max-w-lg flex justify-between items-end py-4 shrink-0 px-2">
        <div>
          <h1 className="text-[44px] leading-[1.05] font-black font-display tracking-tight text-g-text">
            Recorder.
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] font-bold px-3 py-1 bg-g-primary-container text-g-primary rounded-full tracking-wide">
              {tokyoTime.split(':').slice(0, 2).join(':')} JST
            </span>
            <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-g-text-variant">
              Active • Signal Deck
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          {isRecording && <span className="text-[8px] font-bold tracking-[0.2em] text-red-500 uppercase animate-pulse">RECORDING</span>}
          <div className={cn("w-3.5 h-3.5 rounded-full transition-all duration-500 shadow-sm", isRecording ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] scale-110" : "bg-g-outline/35 scale-100")} />
        </div>
      </header>

      {/* Core Deck Cards */}
      <div className="w-full max-w-lg flex flex-col gap-4 mb-4 shrink-0 px-2">
        
        {/* Main Recorder Console Card */}
        <div className="material-card p-6 shadow-sm border-g-outline/10 relative overflow-hidden bg-g-surface">
           <div className="absolute top-0 right-0 w-48 h-48 bg-g-primary/5 blur-3xl -mr-24 -mt-24 rounded-full" />
           <div className="flex justify-between items-start mb-4 relative z-10">
              <button 
                disabled={isRecording}
                onClick={() => { triggerHaptic(); setFidelity(f => f === 'PRO LOSSLESS' ? 'CORE VOICE' : 'PRO LOSSLESS'); }}
                className={cn("flex items-center gap-2 px-3 py-2 bg-g-bg/50 dark:bg-g-bg/20 border border-g-outline/10 rounded-xl transition-all shadow-sm ripple cursor-pointer", isRecording ? "opacity-35" : "hover:bg-g-primary-container hover:text-g-primary hover:border-g-primary/20")}
              >
                <Sliders size={12} className="text-g-primary" />
                <span className="text-[9px] font-black uppercase tracking-wider text-g-text-variant">{fidelity}</span>
              </button>
              <div className="text-right">
                <span className="text-[9px] font-bold text-g-text-variant uppercase tracking-widest block">Format Bitrate</span>
                <span className="text-[11px] font-bold text-g-primary tabular-nums font-mono">48.0 KHZ • WAV</span>
              </div>
           </div>
           
           {/* Timer and Waveform Display Area */}
           <div className="flex flex-col items-center py-2 relative z-10">
              <span className={cn("text-6xl font-black tracking-tighter tabular-nums leading-none transition-all font-display duration-500", isRecording ? "text-g-text" : "text-g-text-variant/40")}>
                {formatTime(elapsed)}
              </span>
              <div className="w-full">
                <CanvasWaveform isRecording={isRecording} history={waveformHistory} />
              </div>
           </div>
        </div>

        {/* Tactical Recording Action Button */}
        <div className="flex items-center justify-center py-2">
           <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleRecord}
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-md cursor-pointer ripple border",
              isRecording 
                ? "bg-red-500 border-red-500/20 text-white scale-110" 
                : "bg-g-primary border-g-primary/20 text-white dark:text-[#202124]"
            )}
          >
            {isRecording ? <Square size={24} className="fill-current" /> : <Play size={24} className="fill-current ml-1.5" />}
          </motion.button>
        </div>
      </div>

      {/* Signal Archives display */}
      <div className="w-full max-w-lg flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-4 px-4">
           <span className="text-[10px] font-bold text-g-text-variant uppercase tracking-[0.2em]">Signal Archives</span>
           <div className="h-[1px] flex-1 bg-g-outline/10 ml-4" />
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-24 px-2 relative">
           <AnimatePresence mode="popLayout" initial={false}>
             {recordings.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-g-aluminium/40 dark:bg-g-aluminium/10 flex items-center justify-center mb-4 opacity-40">
                    <Database size={22} className="text-g-text-variant" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-g-text-variant opacity-40">No signals logged</span>
                </motion.div>
             ) : (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 w-full">
                  {recordings.map((record) => (
                    <motion.div 
                      key={record.id}
                      layout
                      initial={{ opacity: 0, scale: 0.94, y: 15 }}
                      animate={{ opacity: record.isStale ? 0.6 : 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, y: 15 }}
                      transition={{ type: "spring", damping: 20, stiffness: 220 }}
                      className={cn("material-card p-5 flex items-center justify-between group shadow-sm border-g-outline/10 ripple", record.isStale && "bg-g-bg/30 border-dashed border-g-outline/20")}
                    >
                      <div className="flex flex-col gap-1.5 min-w-0">
                         <div className="flex items-center gap-2">
                            <span className="text-base font-extrabold text-g-text font-display truncate">{record.name}</span>
                            {record.isStale && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                         </div>
                         <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-g-text-variant">
                            <span>{record.timestamp}</span>
                            <div className="w-1 h-1 bg-g-outline rounded-full shrink-0" />
                            <span className="tabular-nums font-mono">{formatTime(record.duration)}</span>
                         </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                         <button 
                           onClick={() => playRecording(record)} 
                           className={cn(
                             "w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ripple shadow-sm",
                             currentlyPlaying === record.id 
                               ? "bg-g-primary text-white" 
                               : "bg-g-aluminium/50 dark:bg-g-aluminium/10 text-g-text hover:bg-g-primary-container hover:text-g-primary"
                           )}
                         >
                           {currentlyPlaying === record.id ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                         </button>
                         <button 
                           onClick={() => deleteRecord(record.id)} 
                           className="w-12 h-12 rounded-full bg-g-surface border border-g-outline/15 flex items-center justify-center text-g-text-variant hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all shadow-sm cursor-pointer"
                         >
                           <Trash2 size={16} />
                         </button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
             )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
