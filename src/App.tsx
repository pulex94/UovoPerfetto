/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, RotateCcw, Play, Pause, ChevronLeft, Bell, Sun, Moon, Globe } from 'lucide-react';

// --- Constants & Types ---

enum EggType {
  COQUE = 'coque',
  BARZOTTO = 'barzotto',
  MEDIO = 'medio',
  SODO = 'sodo',
}

type Language = 'it' | 'en' | 'es';

interface Translation {
  title: string;
  subtitle: string;
  ready: string;
  readyMsg: string;
  done: string;
  stop: string;
  footer: string;
  eggs: Record<EggType, { label: string; sublabel: string }>;
}

const TRANSLATIONS: Record<Language, Translation> = {
  it: {
    title: 'UovoPerfetto',
    subtitle: 'Scegli la tua cottura ideale',
    ready: 'Pronto!',
    readyMsg: "L'uovo {type} è pronto per essere gustato.",
    done: 'Fatto',
    stop: 'Stop',
    footer: 'Timer Uova Minimalista',
    eggs: {
      [EggType.COQUE]: { label: 'Alla Coque', sublabel: 'Molto tenero (3 min)' },
      [EggType.BARZOTTO]: { label: 'Barzotto', sublabel: 'Tuorlo cremoso (6 min)' },
      [EggType.MEDIO]: { label: 'Medio', sublabel: 'Cuore morbido (8 min)' },
      [EggType.SODO]: { label: 'Sodo', sublabel: 'Completamente cotto (10 min)' },
    }
  },
  en: {
    title: 'PerfectEgg',
    subtitle: 'Choose your ideal cooking',
    ready: 'Ready!',
    readyMsg: 'The {type} egg is ready to be enjoyed.',
    done: 'Done',
    stop: 'Stop',
    footer: 'Minimalist Egg Timer',
    eggs: {
      [EggType.COQUE]: { label: 'Soft Boiled', sublabel: 'Runny yolk (3 min)' },
      [EggType.BARZOTTO]: { label: 'Creamy', sublabel: 'Jammy yolk (6 min)' },
      [EggType.MEDIO]: { label: 'Medium', sublabel: 'Custard yolk (8 min)' },
      [EggType.SODO]: { label: 'Hard Boiled', sublabel: 'Fully set (10 min)' },
    }
  },
  es: {
    title: 'HuevoPerfecto',
    subtitle: 'Elige tu cocción ideal',
    ready: '¡Listo!',
    readyMsg: 'El huevo {type} está listo para disfrutar.',
    done: 'Hecho',
    stop: 'Parar',
    footer: 'Temporizador de Huevos Minimalista',
    eggs: {
      [EggType.COQUE]: { label: 'Pasado por Agua', sublabel: 'Yema muy líquida (3 min)' },
      [EggType.BARZOTTO]: { label: 'Meloso', sublabel: 'Yema cremosa (6 min)' },
      [EggType.MEDIO]: { label: 'Medio', sublabel: 'Yema tierna (8 min)' },
      [EggType.SODO]: { label: 'Duro', sublabel: 'Totalmente cocido (10 min)' },
    }
  }
};

const FLAGS: Record<Language, string> = {
  it: '🇮🇹',
  en: '🇬🇧',
  es: '🇪🇸'
};

interface EggConfig {
  id: EggType;
  minutes: number;
  yolkColor: string;
  yolkSize: number; // 0 to 1
}

const EGG_CONFIGS: Record<EggType, EggConfig> = {
  [EggType.COQUE]: {
    id: EggType.COQUE,
    minutes: 3,
    yolkColor: '#F59E0B', // Vibrant orange-yellow
    yolkSize: 0.8,
  },
  [EggType.BARZOTTO]: {
    id: EggType.BARZOTTO,
    minutes: 6,
    yolkColor: '#FBBF24', // Rich yellow
    yolkSize: 0.7,
  },
  [EggType.MEDIO]: {
    id: EggType.MEDIO,
    minutes: 8,
    yolkColor: '#FCD34D', // Medium yellow
    yolkSize: 0.6,
  },
  [EggType.SODO]: {
    id: EggType.SODO,
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

const EggIcon = ({ config, active = false, floating = false, isDarkMode = false }: { config: EggConfig; active?: boolean; floating?: boolean; isDarkMode?: boolean }) => {
  // --- IMPOSTAZIONI OMBRE (Shadow Settings) ---
  // Modifica questi valori per cambiare rapidamente l'intensità e la sfocatura (blur)
  const shadowOpacity = isDarkMode ? 0.01 : 0.08; 
  const hoverShadowOpacity = isDarkMode ? 0.02 : 0.15;
  const shadowBlur = isDarkMode ? 1 : 1;
  const hoverShadowBlur = isDarkMode ? 1 : 1;
  const bottomShadowBlur = isDarkMode ? 1 : 1; // Sfocatura ombra a terra

  // --- DISTANZA OMBRE (Distanza/Offset) ---
  const shadowOffset = isDarkMode ? 1 : 1; // Ridotto drasticamente
  const hoverShadowOffset = isDarkMode ? 2 : 2; // Ridotto drasticamente
  const groundOffset = isDarkMode ? 2 : 2; // Distanza da terra

  return (
    <div className="relative flex flex-col items-center group">
      <motion.svg
        viewBox="0 0 100 120"
        className={`w-28 h-28 sm:w-48 sm:h-48 lg:w-64 lg:h-64 relative z-10 ${active ? 'scale-110' : ''}`}
        id={`egg-icon-${config.id}`}
        animate={{
          y: floating ? [0, -10, 0] : 0,
          filter: shadowOpacity > 0 ? `drop-shadow(0 ${shadowOffset}px ${shadowBlur}px rgba(0,0,0,${shadowOpacity}))` : 'none'
        }}
        whileHover={{
          rotate: [0, 10, -10, 6, -6, 0],
          scale: 1.1,
          filter: hoverShadowOpacity > 0 ? `drop-shadow(0 ${hoverShadowOffset}px ${hoverShadowBlur}px rgba(0,0,0,${hoverShadowOpacity}))` : 'none',
        }}
        transition={{
          y: {
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          },
          rotate: { duration: 0.4, ease: "easeOut" },
          scale: { duration: 0.2 },
          filter: { duration: 0.3 }
        }}
      >
        {/* Egg Shell */}
        <path
          d="M50,10 C25,10 10,40 10,75 C10,100 28,115 50,115 C72,115 90,100 90,75 C90,40 75,10 50,10 Z"
          fill="white"
          stroke="#D1D5DB"
          strokeWidth="0.8"
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
          className={`absolute w-16 sm:w-32 lg:w-44 h-2 rounded-full transition-all duration-300 ${isDarkMode ? 'bg-black/5 group-hover:bg-black/10' : 'bg-black/5 group-hover:bg-black/10'}`}
          style={{ 
            filter: `blur(${bottomShadowBlur}px)`,
            bottom: `-${groundOffset}px` 
          }}
          animate={{
            scaleX: [1, 0.85, 1],
            opacity: isDarkMode ? [0.1, 0.05, 0.1] : [0.3, 0.15, 0.3],
          }}
          transition={{
            duration: 3,
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
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [lang, setLang] = useState<Language>('it');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const t = TRANSLATIONS[lang];

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
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-[#1A1A1A] text-[#F5F5F0]' : 'bg-[#F5F5F0] text-[#1A1A1A]'} transition-colors duration-500 font-sans selection:bg-orange-100 flex flex-col items-center p-6 sm:p-12 overflow-x-hidden`} id="app-root">
      
      {/* Header Controls - Posizionamento adattivo */}
      <div className="w-full max-w-7xl flex justify-end items-center gap-4 mb-8 sm:fixed sm:top-8 sm:right-8 sm:mb-0 z-50">
        <div className="relative">
          <button 
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className={`p-2 rounded-full border transition-colors ${isDarkMode ? 'border-white/10 hover:bg-white/5' : 'border-black/5 hover:bg-black/5'}`}
            title="Change Language"
          >
            <span className="text-xl">{FLAGS[lang]}</span>
          </button>
          
          <AnimatePresence>
            {showLanguageMenu && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`absolute top-full right-0 mt-2 p-2 rounded-xl shadow-2xl border flex flex-col gap-1 ${isDarkMode ? 'bg-[#2A2A2A] border-white/10' : 'bg-white border-black/5'}`}
              >
                {(Object.keys(TRANSLATIONS) as Language[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      setLang(l as Language);
                      setShowLanguageMenu(false);
                      playSound('tap');
                    }}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${lang === l ? (isDarkMode ? 'bg-white/10' : 'bg-black/5') : (isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5')}`}
                  >
                    <span>{FLAGS[l as Language]}</span>
                    <span>{l.toUpperCase()}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button 
          onClick={() => {
            setIsDarkMode(!isDarkMode);
            playSound('tap');
          }}
          className={`p-2.5 rounded-full border transition-colors ${isDarkMode ? 'border-white/10 hover:bg-white/5' : 'border-black/5 hover:bg-black/5'}`}
          title={isDarkMode ? "Light Mode" : "Dark Mode"}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {screen === 'selection' && (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-7xl text-center px-4 flex-grow flex flex-col justify-center py-12"
            id="selection-screen"
          >
            <h1 className="text-5xl sm:text-7xl lg:text-9xl font-serif font-light mb-4 tracking-tight" id="main-title">
              {t.title}
            </h1>
            <p className="text-[#8E9299] text-base lg:text-xl font-serif italic mb-12 lg:mb-24" id="main-subtitle">
              {t.subtitle}
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 sm:gap-20 lg:gap-8" id="egg-grid">
              {(Object.keys(EGG_CONFIGS) as EggType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => startTimer(type)}
                  className="flex flex-col items-center group focus:outline-none"
                  id={`btn-${type}`}
                >
                  <div className="mb-6 lg:mb-12 relative w-full flex justify-center">
                    {/* Background Glow - Molto ridotto in Dark Mode */}
                    <div className="absolute inset-0 bg-white dark:bg-white/2 blur-3xl rounded-full opacity-0 group-hover:opacity-20 dark:group-hover:opacity-10 transition-opacity duration-300 scale-125" />
                    <EggIcon config={EGG_CONFIGS[type]} floating isDarkMode={isDarkMode} />
                  </div>
                  <span className="text-sm lg:text-lg font-medium tracking-widest uppercase mb-1">{t.eggs[type].label}</span>
                  <span className="text-xs lg:text-sm text-[#8E9299] italic">{t.eggs[type].sublabel}</span>
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
            className="flex flex-col items-center w-full max-w-sm flex-grow justify-center py-12"
            id="timer-screen"
          >
            {!isAlarmActive && (
              <button
                onClick={resetTimer}
                className="absolute top-8 left-8 p-2 text-[#8E9299] hover:text-[#1A1A1A] dark:hover:text-white transition-colors"
                id="back-button"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <div className="relative w-64 h-64 sm:w-80 sm:h-80 mb-12 flex items-center justify-center">
              {/* Circular Progress */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="48%"
                  fill="none"
                  stroke={isDarkMode ? "#333333" : "#E5E7EB"}
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
                    className="z-20 bg-black dark:bg-white text-white dark:text-black px-8 py-8 rounded-full shadow-2xl flex flex-col items-center justify-center gap-2 group border-4 border-white dark:border-white/20"
                    id="stop-alarm-btn"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Bell className="animate-bounce" size={24} />
                    <span className="text-sm font-bold tracking-widest uppercase">{t.stop}</span>
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
                      {t.eggs[selectedEgg].label}
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className={`flex gap-6 items-center transition-opacity duration-500 ${isAlarmActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} id="timer-controls">
              <button
                onClick={toggleTimer}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  isActive 
                    ? (isDarkMode ? 'bg-white text-black shadow-xl translate-y-[-2px]' : 'bg-[#1A1A1A] text-white shadow-xl translate-y-[-2px]') 
                    : (isDarkMode ? 'bg-[#2A2A2A] border border-white/10 hover:bg-[#3A3A3A]' : 'bg-white border border-[#E5E7EB] hover:bg-gray-50')
                }`}
                id="play-pause-btn"
              >
                {isActive ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
              </button>
              <button
                onClick={() => setTimeLeft(EGG_CONFIGS[selectedEgg!].minutes * 60)}
                className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all text-[#8E9299] ${
                  isDarkMode ? 'bg-[#2A2A2A] border-white/10 hover:bg-[#3A3A3A]' : 'bg-white border-[#E5E7EB] hover:bg-gray-50'
                }`}
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
            className="flex flex-col items-center w-full max-w-sm flex-grow justify-center py-12"
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
                <EggIcon config={EGG_CONFIGS[selectedEgg]} active isDarkMode={isDarkMode} />
              </motion.div>
            </div>

            <h2 className="text-4xl font-serif font-light mb-4" id="ready-title">
              {t.ready}
            </h2>
            <p className="text-[#8E9299] italic mb-12">
              {t.readyMsg.replace('{type}', t.eggs[selectedEgg].label.toLowerCase())}
            </p>

            <button
              onClick={resetTimer}
              className={`px-8 py-3 rounded-full text-sm font-medium tracking-wide uppercase transition-colors ${
                isDarkMode ? 'bg-white text-black hover:bg-gray-100' : 'bg-[#1A1A1A] text-white hover:bg-black'
              }`}
              id="finish-btn"
            >
              {t.done}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-auto pt-12 pb-4 text-[10px] uppercase tracking-[0.2em] text-[#8E9299] font-medium opacity-50 sm:fixed sm:bottom-8 sm:pb-0" id="footer">
        {t.footer} &bull; 2026
      </footer>
    </div>
  );
}
