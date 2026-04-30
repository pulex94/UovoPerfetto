/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, RotateCcw, Play, Pause, ChevronLeft, Bell } from 'lucide-react';

// --- Constants & Types ---

enum EggType {
  COQUE = 'coque',
  BARZOTTO = 'barzotto',
  MEDIO = 'medio',
  SODO = 'sodo',
}

interface EggConfig {
  id: EggType;
  label: string;
  sublabel: string;
  minutes: number;
  yolkColor: string;
  yolkSize: number; // 0 to 1
}

const EGG_CONFIGS: Record<EggType, EggConfig> = {
  [EggType.COQUE]: {
    id: EggType.COQUE,
    label: 'Alla Coque',
    sublabel: 'Molto tenero (3 min)',
    minutes: 3,
    yolkColor: '#F59E0B', // Vibrant orange-yellow
    yolkSize: 0.8,
  },
  [EggType.BARZOTTO]: {
    id: EggType.BARZOTTO,
    label: 'Barzotto',
    sublabel: 'Tuorlo cremoso (6 min)',
    minutes: 6,
    yolkColor: '#FBBF24', // Rich yellow
    yolkSize: 0.7,
  },
  [EggType.MEDIO]: {
    id: EggType.MEDIO,
    label: 'Medio',
    sublabel: 'Cuore morbido (8 min)',
    minutes: 8,
    yolkColor: '#FCD34D', // Medium yellow
    yolkSize: 0.6,
  },
  [EggType.SODO]: {
    id: EggType.SODO,
    label: 'Sodo',
    sublabel: 'Completamente cotto (10 min)',
    minutes: 10,
    yolkColor: '#FEF3C7', // Pale yellow
    yolkSize: 0.5,
  },
};

// --- Utils ---

let audioCtx: AudioContext | null = null;

const playSound = (type: 'tap' | 'complete') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    
    // Resume context if suspended (browser security)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const playNote = (freq: number, start: number, duration: number, volume: number = 0.1) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(start);
      osc.stop(start + duration);
    };

    const now = audioCtx.currentTime;
    if (type === 'tap') {
      playNote(400, now, 0.3, 0.05);
    } else if (type === 'complete') {
      playNote(523.25, now, 0.8, 0.08);       // C5
      playNote(659.25, now + 0.15, 0.8, 0.08);  // E5
      playNote(783.99, now + 0.3, 1.0, 0.08);   // G5
      playNote(1046.50, now + 0.45, 1.2, 0.08); // C6
    }
  } catch (e) {
    console.warn('Audio operation failed', e);
  }
};

// --- Components ---

const EggIcon = ({ config, active = false, floating = false }: { config: EggConfig; active?: boolean; floating?: boolean }) => {
  return (
    <div className="relative flex flex-col items-center group/egg">
      <motion.svg
        viewBox="0 0 100 120"
        className={`w-24 h-24 relative z-10 ${active ? 'scale-110' : ''}`}
        id={`egg-icon-${config.id}`}
        animate={floating ? {
          y: [0, -6, 0],
        } : {}}
        whileHover={{
          rotate: [0, 12, -12, 8, -8, 0],
          scale: 1.15,
          filter: 'drop-shadow(0 25px 30px rgba(0,0,0,0.25))',
        }}
        initial={{ filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.12))' }}
        transition={{
          y: floating ? {
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          } : {},
          rotate: { duration: 0.4, ease: "easeOut" },
          scale: { duration: 0.2 },
          filter: { duration: 0.2 }
        }}
        style={{ filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.12))' }}
      >
        {/* Egg Shell */}
        <path
          d="M50,10 C25,10 10,40 10,75 C10,100 28,115 50,115 C72,115 90,100 90,75 C90,40 75,10 50,10 Z"
          fill="white"
          stroke="#D1D5DB"
          strokeWidth="1"
        />
        {/* Yolk */}
        <motion.circle
          cx="50"
          cy="75"
          initial={{ r: 0 }}
          animate={{ r: 25 * config.yolkSize }}
          fill={config.yolkColor}
          opacity={0.9}
        />
      </motion.svg>
      
      {/* Dynamic Shadow */}
      {floating && (
        <motion.div
          className="absolute bottom-[-6px] w-14 h-1.5 bg-black/10 rounded-full blur-[3px] group-hover/egg:bg-black/20 group-hover/egg:scale-x-125 transition-all duration-200"
          animate={{
            scaleX: [1, 0.8, 1],
            opacity: [0.2, 0.1, 0.2],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  const [screen, setScreen] = useState<'selection' | 'timer' | 'complete'>('selection');
  const [selectedEgg, setSelectedEgg] = useState<EggType | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = (eggType: EggType) => {
    playSound('tap');
    setSelectedEgg(eggType);
    setTimeLeft(EGG_CONFIGS[eggType].minutes * 60);
    setScreen('timer');
    setIsActive(true);
    setIsAlarmActive(false);
  };

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      setIsAlarmActive(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  // Handle persistent alarm sound
  useEffect(() => {
    if (isAlarmActive) {
      playSound('complete');
      alarmIntervalRef.current = setInterval(() => {
        playSound('complete');
      }, 2000);
    } else {
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    }
    return () => {
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    };
  }, [isAlarmActive]);

  const toggleTimer = () => {
    if (isAlarmActive) return;
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setIsAlarmActive(false);
    setScreen('selection');
    setSelectedEgg(null);
  };

  const stopAlarm = () => {
    setIsAlarmActive(false);
    resetTimer();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = selectedEgg ? 1 - timeLeft / (EGG_CONFIGS[selectedEgg].minutes * 60) : 0;

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans selection:bg-orange-100 flex flex-col items-center justify-center p-6 sm:p-12 overflow-hidden" id="app-root">
      <AnimatePresence mode="wait">
        {screen === 'selection' && (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-xl text-center"
            id="selection-screen"
          >
            <h1 className="text-4xl sm:text-5xl font-serif font-light mb-4 tracking-tight" id="main-title">
              UovoPerfetto
            </h1>
            <p className="text-[#8E9299] font-serif italic mb-12" id="main-subtitle">
              Scegli la tua cottura ideale
            </p>

            <div className="grid grid-cols-2 gap-8 sm:gap-12" id="egg-grid">
              {(Object.keys(EGG_CONFIGS) as EggType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => startTimer(type)}
                  className="flex flex-col items-center group focus:outline-none"
                  id={`btn-${type}`}
                >
                  <div className="mb-4 relative">
                    <div className="absolute inset-0 bg-white blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-150" />
                    <EggIcon config={EGG_CONFIGS[type]} floating />
                  </div>
                  <span className="text-sm font-medium tracking-wide uppercase mb-1">{EGG_CONFIGS[type].label}</span>
                  <span className="text-xs text-[#8E9299] italic">{EGG_CONFIGS[type].sublabel}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {screen === 'timer' && selectedEgg && (
          <motion.div
            key="timer"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            className="flex flex-col items-center w-full max-w-sm"
            id="timer-screen"
          >
            <button
              onClick={resetTimer}
              className="absolute top-8 left-8 p-2 text-[#8E9299] hover:text-[#1A1A1A] transition-colors"
              id="back-button"
            >
              <ChevronLeft size={24} />
            </button>

            <div className="relative w-64 h-64 sm:w-80 sm:h-80 mb-12 flex items-center justify-center">
              {/* Circular Progress */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="48%"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="4"
                />
                <motion.circle
                  cx="50%"
                  cy="50%"
                  r="48%"
                  fill="none"
                  stroke={EGG_CONFIGS[selectedEgg].yolkColor}
                  strokeWidth={isAlarmActive ? 6 : 4}
                  strokeDasharray="100 100"
                  animate={{ 
                    strokeDashoffset: (1 - progress) * 100,
                    scale: isAlarmActive ? [1, 1.02, 1] : 1
                  }}
                  pathLength="100"
                  transition={{ 
                    duration: isAlarmActive ? 1 : 1, 
                    ease: "linear",
                    repeat: isAlarmActive ? Infinity : 0
                  }}
                />
              </svg>

              <AnimatePresence mode="wait">
                {isAlarmActive ? (
                  <motion.button
                    key="stop-btn"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    onClick={stopAlarm}
                    className="z-20 bg-black text-white px-8 py-8 rounded-full shadow-2xl flex flex-col items-center justify-center gap-2 group border-4 border-white"
                    id="stop-alarm-btn"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Bell className="animate-bounce" size={24} />
                    <span className="text-sm font-bold tracking-widest uppercase">Stop</span>
                  </motion.button>
                ) : (
                  <div className="text-center z-10">
                    <motion.div
                      key={timeLeft}
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: 1 }}
                      className="text-6xl sm:text-7xl font-mono font-light tracking-tighter"
                      id="timer-display"
                    >
                      {formatTime(timeLeft)}
                    </motion.div>
                    <div className="text-xs uppercase tracking-widest text-[#8E9299] mt-2 font-medium">
                      {EGG_CONFIGS[selectedEgg].label}
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className={`flex gap-6 items-center transition-opacity duration-500 ${isAlarmActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} id="timer-controls">
              <button
                onClick={toggleTimer}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  isActive ? 'bg-[#1A1A1A] text-white shadow-xl translate-y-[-2px]' : 'bg-white border border-[#E5E7EB] hover:bg-gray-50'
                }`}
                id="play-pause-btn"
              >
                {isActive ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
              </button>
              <button
                onClick={() => setTimeLeft(EGG_CONFIGS[selectedEgg!].minutes * 60)}
                className="w-12 h-12 rounded-full border border-[#E5E7EB] flex items-center justify-center bg-white hover:bg-gray-50 text-[#8E9299] transition-all"
                id="reset-btn"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </motion.div>
        )}

        {screen === 'complete' && selectedEgg && (
          <motion.div
            key="complete"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center max-w-sm"
            id="complete-screen"
          >
            <div className="mb-8 relative flex justify-center">
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <EggIcon config={EGG_CONFIGS[selectedEgg]} active />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-2 shadow-lg"
              >
                <Bell size={20} />
              </motion.div>
            </div>

            <h2 className="text-4xl font-serif font-light mb-4" id="ready-title">
              Pronto!
            </h2>
            <p className="text-[#8E9299] italic mb-12">
              L&apos;uovo {EGG_CONFIGS[selectedEgg].label.toLowerCase()} &egrave; pronto per essere gustato.
            </p>

            <button
              onClick={resetTimer}
              className="px-8 py-3 bg-[#1A1A1A] text-white rounded-full text-sm font-medium tracking-wide uppercase hover:bg-black transition-colors"
              id="finish-btn"
            >
              Fatto
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="fixed bottom-8 text-[10px] uppercase tracking-[0.2em] text-[#8E9299] font-medium opacity-50" id="footer">
        Minimalist Egg Timer &bull; 2026
      </footer>
    </div>
  );
}
