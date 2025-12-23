
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  BarChart2, 
  ChevronLeft, 
  ChevronRight, 
  History, 
  Smile, 
  Frown, 
  Meh, 
  Save,
  Home,
  Trash2,
  Edit2,
  Plus, 
  Minus,
  Check,       
  RotateCcw,
  Settings,
  Download,
  X
} from 'lucide-react';
import { Entry, EntryType, Lang, Page } from './types';
import { TEXT } from './constants';
import { GlassCard } from './components/GlassCard';
import { Heatmap } from './components/Heatmap';
import { 
  initDB, 
  getAllEntries, 
  saveEntry as saveEntryToDB, 
  deleteEntry, 
  importEntriesFromJSON 
} from './indexedDB';

export default function App() {
  const [page, setPage] = useState<Page>(1); 
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [lang, setLang] = useState<Lang>('en');

  // Initialize database and load entries on mount
  useEffect(() => {
    const loadEntries = async () => {
      try {
        await initDB();
        const loadedEntries = await getAllEntries();
        setEntries(loadedEntries);
      } catch (error) {
        console.error('Failed to load entries from IndexedDB:', error);
      } finally {
        setIsLoadingEntries(false);
      }
    };

    loadEntries();
  }, []);

  // Note: we persist changes directly on add/edit/delete.

  useEffect(() => {
    const browserLang = (navigator.language || (navigator as any).userLanguage || '').toLowerCase();
    setLang(browserLang.includes('zh') ? 'zh' : 'en');
  }, []);

  // Dynamically adjust theme-color so the installed PWA status bar matches the current page.
  // (Android uses this for status bar tint; iOS standalone mostly relies on apple status bar settings.)
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const color = page === 1 ? '#10b981' : '#f2f2f7';
    meta.setAttribute('content', color);
  }, [page]);

  const t = (key: keyof typeof TEXT['en']) => TEXT[lang][key] || key;

  // --- State for Modal / Entry ---
  const [tempScore, setTempScore] = useState(0); 
  const [tempType, setTempType] = useState<EntryType | null>(null); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Fix: Avoid using NodeJS.Timeout namespace as it might not be available in all browser TS environments.
  const [clickTimer, setClickTimer] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [note, setNote] = useState("");
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [currentViewMonth, setCurrentViewMonth] = useState("");
  const historyListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (entries.length > 0) {
      const d = new Date(entries[0].date);
      setCurrentViewMonth(d.toLocaleString('en-US', { month: 'short' }));
    } else {
      setCurrentViewMonth(new Date().toLocaleString('en-US', { month: 'short' }));
    }
  }, [entries]);

  const getCategoryKeys = (type: EntryType | null) => {
    const commonBase = ["cat_work", "cat_study", "cat_life", "cat_social"];
    if (type === 'lucky') return [...commonBase, "cat_surprise"];
    if (type === 'unlucky') return [...commonBase, "cat_disaster"];
    return [...commonBase];
  };

  const exportToJSON = async () => {
    try {
      const dataStr = JSON.stringify(entries, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `luckcalendar_export_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      const msg = document.createElement("div");
      msg.textContent = t('export_msg' as any);
      msg.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:12px 24px;border-radius:12px;z-index:9999;font-weight:bold;backdrop-filter:blur(10px);";
      document.body.appendChild(msg);
      setTimeout(() => document.body.removeChild(msg), 1500);
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  // --- Gesture Handling ---
  const minSwipeDistance = 50;
  const onTouchStart = (e: React.TouchEvent) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e: React.TouchEvent) => { setTouchEnd(e.targetTouches[0].clientX); };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance && page === 1) setPage(2);
    if (distance < -minSwipeDistance && page === 2) setPage(1);
    if (distance > minSwipeDistance && page === 2) setPage(3);
    if (distance < -minSwipeDistance && page === 3) setPage(2);
  };

  const handleScoreClick = (type: EntryType) => {
    setEditingId(null);
    if (type === 'neutral') {
      setTempType('neutral'); 
      setTempScore(0); 
      setNote(""); 
      setSelectedCategory(t('cat_life' as any)); 
      setIsModalOpen(true);
      return;
    }
    
    if (tempType !== type) {
      setTempType(type);
      setTempScore(1);
    } else {
      // Stop at 5 on repeated taps (no looping back to 1)
      setTempScore(prev => Math.min(5, prev + 1));
    }

    if (clickTimer) clearTimeout(clickTimer);
    const newTimer = setTimeout(() => {
      setNote(""); 
      setSelectedCategory(""); 
      setIsModalOpen(true);
    }, 800); 
    setClickTimer(newTimer);
  };

  useEffect(() => {
    if (!isModalOpen) { 
      setTempScore(0); 
      setTempType(null); 
      setEditingId(null); 
      setNote(""); 
      setSelectedCategory(""); 
    }
  }, [isModalOpen]);

  const saveEntryFromModal = async (targetPage: Page | null) => {
    const actualVal = tempType === 'lucky' ? tempScore : tempType === 'unlucky' ? -tempScore : 0;
    const entryData: Omit<Entry, 'id' | 'date'> = {
        type: tempType || 'neutral',
        score: tempType === 'neutral' ? 0 : tempScore,
        actualValue: actualVal,
        category: selectedCategory || t('cat_uncategorized' as any),
        note: note
    };

    if (editingId) {
      setEntries(prev => prev.map(item => item.id === editingId ? { ...item, ...entryData } : item));

      // Persist updated entry (compute from current state)
      const updated: Entry | undefined = entries.find(e => e.id === editingId)
        ? ({ ...(entries.find(e => e.id === editingId) as Entry), ...entryData } as Entry)
        : undefined;

      if (updated) {
        try {
          await saveEntryToDB(updated);
        } catch (error) {
          console.error('Failed to save edited entry to IndexedDB:', error);
        }
      }
    } else {
      const newEntry: Entry = { 
        id: Date.now(), 
        date: new Date().toISOString(), 
        ...entryData 
      };
      setEntries([newEntry, ...entries]);

      // Persist new entry
      try {
        await saveEntryToDB(newEntry);
      } catch (error) {
        console.error('Failed to save new entry to IndexedDB:', error);
      }
    }
    
    setIsModalOpen(false);
    if (targetPage) setPage(targetPage);
  };

  const confirmDelete = async () => { 
    if (deleteConfirmId) {
      try {
        await deleteEntry(deleteConfirmId);
        setEntries(prev => prev.filter(e => e.id !== deleteConfirmId)); 
      } catch (error) {
        console.error('Failed to delete entry:', error);
      }
      setDeleteConfirmId(null); 
    }
  };

  const startEdit = (entry: Entry) => {
    setEditingId(entry.id); 
    setTempType(entry.type); 
    setTempScore(entry.score); 
    setSelectedCategory(entry.category); 
    setNote(entry.note); 
    setIsModalOpen(true);
  };

  const handleHistoryScroll = () => {
    if (!historyListRef.current) return;
    const containerTop = historyListRef.current.getBoundingClientRect().top;
    // Fix: Explicitly cast children to HTMLElement[] to resolve property access on 'unknown' error.
    const children = Array.from(historyListRef.current.children) as HTMLElement[];
    for (let child of children) {
        const rect = child.getBoundingClientRect();
        if (rect.bottom > containerTop) {
            const dateStr = child.getAttribute('data-date');
            if (dateStr) {
                const monthStr = new Date(dateStr).toLocaleString('en-US', { month: 'short' });
                if (monthStr !== currentViewMonth) setCurrentViewMonth(monthStr);
            }
            break; 
        }
    }
  };

  const currentMonthEntries = useMemo(() => {
    const now = new Date();
    return entries.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [entries]);

  const stats = useMemo(() => {
    const lucky = currentMonthEntries.filter(e => e.type === 'lucky');
    const unlucky = currentMonthEntries.filter(e => e.type === 'unlucky');
    const luckyTotal = lucky.reduce((acc, cur) => acc + cur.score, 0);
    const unluckyTotal = unlucky.reduce((acc, cur) => acc + cur.score, 0);
    return { 
      luckyCount: lucky.length, 
      unluckyCount: unlucky.length, 
      netScore: luckyTotal - unluckyTotal 
    };
  }, [currentMonthEntries]);

  const insightStats = useMemo(() => {
    const getTopCategory = (list: Entry[]) => {
        if (!list.length) return { name: "None", count: 0 }; 
        const counts: Record<string, number> = {};
        list.forEach(item => { const cat = item.category || "None"; counts[cat] = (counts[cat] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
        return { name: sorted[0][0], count: sorted[0][1] }; 
    };
    const topLucky = getTopCategory(currentMonthEntries.filter(e => e.type === 'lucky'));
    const topUnlucky = getTopCategory(currentMonthEntries.filter(e => e.type === 'unlucky'));
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEntries = entries.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
    });
    const lastMonthNet = lastMonthEntries.reduce((acc, cur) => acc + cur.actualValue, 0);
    return { topLucky, topUnlucky, lastMonthNet, lastMonthName: lastMonthDate.toLocaleString('en-US', { month: 'long' }) };
  }, [currentMonthEntries, entries]);

  return (
    <div
      className="w-full bg-[#f2f2f7] text-slate-900 font-sans selection:bg-indigo-100 flex justify-center items-stretch p-0 md:p-4"
      style={{
        height: 'calc(var(--app-vh, 1vh) * 100)',
        minHeight: 'calc(var(--app-vh, 1vh) * 100)'
      }}
    >
      {/**
       * PWA edge-to-edge safe-area handling:
       * - Do NOT pad the outermost shell, otherwise you create visible "white strips" in safe areas.
       * - Instead, let page backgrounds bleed to the edges, and add safe-area padding only to UI content.
       */}
      <div 
        className="w-full md:max-w-md h-[100dvh] md:h-[850px] bg-white md:rounded-[44px] shadow-none md:shadow-2xl border-none md:border-[8px] md:border-slate-900/5 relative overflow-hidden flex flex-col"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        {/* Loading State */}
        {isLoadingEntries && (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-slate-900 animate-spin"></div>
              <p className="text-sm font-semibold text-slate-400">{t('loading' as any) || 'Loading...'}</p>
            </div>
          </div>
        )}

        {/* Page Content */}
        {!isLoadingEntries && (
          <>
        {/* --- Page 1: Input --- */}
        {page === 1 && (
          <div className="flex-1 relative w-full h-full overflow-hidden animate-fade-in bg-slate-50">
              <div 
                onClick={() => handleScoreClick('lucky')} 
                className={`absolute top-0 left-0 w-full h-full transition-all duration-300 ease-out cursor-pointer z-10 hover:brightness-105`} 
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 55%, 0 45%)', background: 'linear-gradient(135deg, #a7f3d0 0%, #10b981 100%)', filter: tempType === 'lucky' && tempScore > 0 ? `saturate(${1 + tempScore * 0.1}) brightness(${1 - tempScore * 0.02})` : 'none' }}
              >
                 <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none transition-transform duration-300" style={{ transform: tempType === 'lucky' ? `translate(-50%, -50%) scale(${1 + tempScore * 0.15})` : 'translate(-50%, -50%)' }}>
                   <Smile size={200} strokeWidth={1} color="white" />
                 </div>
              </div>

              <div 
                onClick={() => handleScoreClick('unlucky')} 
                className={`absolute top-0 left-0 w-full h-full transition-all duration-300 ease-out cursor-pointer z-0 hover:brightness-105`} 
                style={{ clipPath: 'polygon(0 45%, 100% 55%, 100% 100%, 0 100%)', background: 'linear-gradient(135deg, #fecdd3 0%, #f43f5e 100%)', filter: tempType === 'unlucky' && tempScore > 0 ? `saturate(${1 + tempScore * 0.1}) brightness(${1 - tempScore * 0.02})` : 'none' }}
              >
                 <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 opacity-20 pointer-events-none transition-transform duration-300" style={{ transform: tempType === 'unlucky' ? `translate(-50%, 50%) scale(${1 + tempScore * 0.15})` : 'translate(-50%, 50%)' }}>
                   <Frown size={200} strokeWidth={1} color="white" />
                 </div>
              </div>

              <div onClick={() => handleScoreClick('neutral')} className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer group">
                  <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-300 ${tempScore > 0 ? 'bg-white opacity-100 scale-150' : 'bg-white opacity-60 group-hover:opacity-100'}`}></div>
                  <div className={`w-28 h-28 rounded-full bg-white/40 backdrop-blur-xl border-2 border-white/60 shadow-2xl flex items-center justify-center transition-all duration-300 ${tempScore > 0 ? 'scale-110 bg-white/80' : 'active:scale-90'}`}>
                     {tempScore > 0 ? (
                       <span className={`text-6xl font-black font-mono tracking-tighter transition-transform duration-200 ${tempType === 'lucky' ? 'text-emerald-600' : 'text-rose-600'}`}>
                         {tempScore}
                       </span>
                     ) : (
                       <Meh size={50} className="text-slate-600/60" strokeWidth={1.5} />
                     )}
                  </div>
              </div>

                {/* Home page: bottom buttons removed */}
          </div>
        )}

        {/* --- Page 2: Dashboard --- */}
        {page === 2 && (
          <div
            className="flex-1 min-h-0 flex flex-col p-6 overflow-y-auto z-10 animate-slide-in-right bg-[#f2f2f7] hide-scrollbar pb-32"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 8rem)'
            }}
          >
            <header className="mb-3 flex items-start">
              <div>
                <div className="text-xs font-bold text-slate-400 mb-0.1 uppercase tracking-[0.2em]">{new Date().getFullYear()}</div>
                <h2 className="text-[28px] font-extrabold text-slate-700 tracking-tight">{new Date().toLocaleString('en-US', { month: 'long' })}</h2>
              </div>
            </header>

            <GlassCard className="p-0 mb-3 flex flex-col border-none bg-white text-slate-900 shadow-lg shadow-slate-100 h-[80px]">
              <div className="grid grid-cols-3 divide-x divide-slate-100 py-3.5 items-center h-28">
                <div className="px-2 text-center flex flex-col items-center justify-center">
                  <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest leading-tight">{t('stats_lucky' as any)}</div>
                  <div className="text-[29px] font-medium tracking-tighter text-emerald-600">{stats.luckyCount}</div>
                </div>
                <div className="px-2 text-center flex flex-col items-center justify-center">
                  <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest leading-tight">{t('stats_unlucky' as any)}</div>
                  <div className="text-[29px] font-medium tracking-tighter text-rose-600">{stats.unluckyCount}</div>
                </div>
                <div className="px-2 text-center flex flex-col items-center justify-center">
                  <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest leading-tight">{t('stats_net' as any)}</div>
                  <div className="text-[29px] font-normal tracking-tighter text-slate-400">{stats.netScore > 0 ? '+' : ''}{stats.netScore}</div>
                </div>
              </div>
            </GlassCard>

            <div className="grid grid-cols-2 gap-2 mb-3">
                <GlassCard className="p-4 flex flex-col justify-center h-24 bg-gradient-to-br from-white to-emerald-50 border-emerald-50">
                    <div className="text-lg font-semibold text-emerald-600 leading-tight mb-1 line-clamp-2">{insightStats.topLucky.name}</div>
                    <div className="text-[10px] font-boldnormal text-emerald-400 uppercase tracking-widest">{t('mentioned' as any)}: {insightStats.topLucky.count}</div>
                </GlassCard>
                 <GlassCard className="p-4 flex flex-col justify-center h-24 bg-gradient-to-br from-white to-rose-50 border-rose-50">
                    <div className="text-lg font-semibold text-rose-600 leading-tight mb-1 line-clamp-2">{insightStats.topUnlucky.name}</div>
                     <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">{t('mentioned' as any)}: {insightStats.topUnlucky.count}</div>
                </GlassCard>
            </div>

            <GlassCard className="mb-3 p-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('last_month' as any)}</div>
                  <div className="text-sm font-bold text-slate-600">{insightStats.lastMonthName}</div>
                </div>
                <div className={`text-4xl font-normal tabular-nums ${insightStats.lastMonthNet > 0 ? 'text-emerald-600' : insightStats.lastMonthNet < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {insightStats.lastMonthNet > 0 ? '+' : ''}{insightStats.lastMonthNet}
                </div>
            </GlassCard>

            <GlassCard className="p-0 mb-3 flex flex-col">
              <div className="p-6 pt-4 flex justify-center">
                <Heatmap entries={entries} />
              </div>
            </GlassCard>

            <div className="absolute left-0 w-full px-8 flex justify-center z-20 pointer-events-none" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 2.5rem)' }}>
                <div className="flex gap-4 pointer-events-auto bg-white/90 backdrop-blur-xl p-2 rounded-full shadow-2xl border border-white/50">
                    <button onClick={() => setPage(1)} className="p-4 rounded-full text-slate-300 hover:text-slate-900 transition-all"><Home size={24} /></button>
                    <div className="w-[1px] bg-slate-200 my-2"></div>
                    <button onClick={() => setPage(3)} className="p-4 rounded-full text-slate-300 hover:text-slate-900 transition-all"><History size={24} /></button>
                </div>
            </div>
          </div>
        )}

        {/* --- Page 3: History --- */}
        {page === 3 && (
          <div
            className="flex-1 h-full flex flex-col p-6 bg-[#f2f2f7] relative z-10 animate-slide-in-right overflow-hidden"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)'
            }}
          >
             <header className="mb-6 flex justify-between items-end flex-shrink-0">
               <div>
                 <div className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-widest">{t('archives' as any)}</div>
                 <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">{currentViewMonth || "Logs"}</h2>
               </div>
               <div className="text-sm font-bold text-slate-900 bg-white px-4 py-2 rounded-full shadow-lg shadow-slate-100">{entries.length}</div>
            </header>

            <div 
              className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-32 touch-pan-y hide-scrollbar" 
              ref={historyListRef} 
              onScroll={handleHistoryScroll}
            >
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                  <History size={64} className="mb-4 opacity-10" />
                  <p className="font-bold">{t('no_records' as any)}</p>
                </div>
              ) : (
                entries.map(entry => (
                  <GlassCard 
                    key={entry.id} 
                    dataDate={entry.date}
                    className="p-5 flex items-center justify-between min-h-[84px] group !rounded-[24px] active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center text-white font-black shadow-lg text-xl flex-shrink-0 ${entry.type === 'lucky' ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-emerald-100' : entry.type === 'unlucky' ? 'bg-gradient-to-br from-rose-400 to-rose-500 shadow-rose-100' : 'bg-slate-400'}`}>
                        {entry.type === 'lucky' ? '+' : entry.type === 'unlucky' ? '-' : ''}{entry.score}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-[16px]">{entry.category}</span>
                        </div>
                        <p className="text-[13px] text-slate-400 mt-1 font-semibold truncate max-w-[160px]">
                          {new Date(entry.date).toLocaleDateString('en-US', {month:'short', day:'numeric'})}
                          {entry.note ? <span className="text-slate-500 ml-2 font-medium">· {entry.note}</span> : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => startEdit(entry)} className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"><Edit2 size={18} /></button>
                      <button onClick={() => setDeleteConfirmId(entry.id)} className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </GlassCard>
                ))
              )}
            </div>

            <div className="absolute left-0 w-full px-8 flex justify-center z-20 pointer-events-none" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 2.5rem)' }}>
                <div className="flex gap-4 pointer-events-auto bg-white/90 backdrop-blur-xl p-2 rounded-full shadow-2xl border border-white/50">
                    <button onClick={() => setPage(2)} className="p-4 rounded-full text-slate-300 hover:text-slate-900 transition-all"><ChevronLeft size={24} /></button>
                    <div className="w-[1px] bg-slate-200 my-2"></div>
                    <button onClick={() => setIsSettingsOpen(true)} className="p-4 rounded-full text-slate-300 hover:text-slate-900 transition-all"><Settings size={24} /></button>
                </div>
            </div>
          </div>
        )}
        
        {/* --- Modals & Overlays --- */}
        
        {isSettingsOpen && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-md animate-fade-in">
             <GlassCard className="w-64 bg-white/95 shadow-3xl rounded-[40px] p-10 flex flex-col items-center gap-8 relative">
                <button onClick={() => setIsSettingsOpen(false)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-600 transition-colors"><X size={24} /></button>
                <div className="text-center flex flex-col items-center gap-6">
                  <button 
                    onClick={exportToJSON}
                    className="w-24 h-24 rounded-[32px] bg-slate-100 text-slate-900 shadow-2xl shadow-slate-200 flex items-center justify-center active:scale-90 transition-all hover:bg-slate-200"
                    aria-label="Export"
                    title="Export"
                  >
                    <Download size={40} strokeWidth={2.5} />
                  </button>

                  {/* Language toggle: no-text design, only show En / 中 */}
                  <div
                    className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-full border border-white/60 shadow-sm"
                    role="group"
                    aria-label="Language"
                  >
                    <button
                      type="button"
                      onClick={() => setLang('en')}
                      className={`w-12 h-10 rounded-full font-black text-sm transition-all ${lang === 'en' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-slate-700'}`}
                      aria-pressed={lang === 'en'}
                    >
                      En
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang('zh')}
                      className={`w-12 h-10 rounded-full font-black text-sm transition-all ${lang === 'zh' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-slate-700'}`}
                      aria-pressed={lang === 'zh'}
                    >
                      中
                    </button>
                  </div>
                </div>
             </GlassCard>
          </div>
        )}

        {deleteConfirmId && (
            <div className="absolute inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-[4px] animate-fade-in">
                <GlassCard className="w-[240px] bg-white shadow-3xl rounded-[32px] p-6 flex items-center justify-between gap-4">
                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 h-16 rounded-[20px] bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-colors">
                      <RotateCcw size={28} />
                    </button>
                    <button onClick={confirmDelete} className="flex-1 h-16 rounded-[20px] bg-rose-500 text-white shadow-xl shadow-rose-200 hover:bg-rose-600 flex items-center justify-center transition-colors">
                      <Check size={32} strokeWidth={3} />
                    </button>
                </GlassCard>
            </div>
        )}

        {isModalOpen && (
          <div className="absolute inset-0 z-[90] flex items-center justify-center p-6 bg-black/10 backdrop-blur-sm animate-fade-in-up">
            <GlassCard className="w-full max-w-sm p-8 bg-white/95 shadow-3xl rounded-[40px]">
              <div 
                className={`mb-8 p-8 rounded-[32px] text-center border-2 cursor-pointer active:scale-95 transition-all ${tempType === 'lucky' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : tempType === 'unlucky' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-slate-50 border-slate-100 text-slate-700'}`} 
                onClick={() => setIsModalOpen(false)}
              >
                <h2 className="text-3xl font-black mb-2 tracking-tighter">
                  {tempType === 'lucky' ? t('lucky_title' as any) : tempType === 'unlucky' ? t('unlucky_title' as any) : t('neutral_title' as any)}
                </h2>
                {tempType !== 'neutral' && (
                    <div className="flex items-center justify-center gap-8 my-4">
                        <button onClick={(e) => { e.stopPropagation(); setTempScore(p => Math.max(1, p - 1)); }} className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition-all"><Minus size={24} /></button>
                        <span className="text-5xl font-black font-mono tabular-nums tracking-tighter">{tempScore}</span>
                        <button onClick={(e) => { e.stopPropagation(); setTempScore(p => Math.min(5, p + 1)); }} className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition-all"><Plus size={24} /></button>
                    </div>
                )}
                <p className="text-xs font-bold uppercase tracking-widest opacity-40 mt-2">{editingId ? t('editing' as any) : t('undo' as any)}</p>
              </div>

              {tempType !== 'neutral' && (
                <div className="mb-8">
                  <label className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em] mb-4 block pl-1">{t('reason_label' as any)}</label>
                  <div className="flex flex-wrap gap-2">
                    {getCategoryKeys(tempType).map(key => {
                      const label = t(key as any);
                      return (
                        <button 
                          key={key} 
                          onClick={() => setSelectedCategory(label)} 
                          className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all ${selectedCategory === label ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 active:scale-95'}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mb-8">
                <input 
                  type="text" 
                  placeholder={t('placeholder' as any)} 
                  value={note} 
                  onChange={(e) => setNote(e.target.value)} 
                  className="w-full bg-slate-50 border-2 border-slate-50 rounded-[24px] px-6 py-5 text-[15px] font-bold focus:outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-300"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => saveEntryFromModal(null)} 
                  className="flex-1 py-5 rounded-[24px] bg-slate-100 text-slate-900 font-black hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save size={20} strokeWidth={3} />
                </button>
                <button 
                  onClick={() => saveEntryFromModal(2)} 
                  className="flex-1 py-5 rounded-[24px] bg-slate-100 text-slate-900 font-black hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-slate-100"
                >
                  <BarChart2 size={20} strokeWidth={3} />
                </button>
              </div>
            </GlassCard>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
