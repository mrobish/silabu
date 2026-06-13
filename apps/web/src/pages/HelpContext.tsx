import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface HelpContextValue {
  isOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
  toggleHelp: () => void;
  highlightTarget: string | null;
  setHighlight: (target: string | null) => void;
  helpPage: string;
  setHelpPage: (page: string) => void;
}

const HelpContext = createContext<HelpContextValue>({
  isOpen: false,
  openHelp: () => {},
  closeHelp: () => {},
  toggleHelp: () => {},
  highlightTarget: null,
  setHighlight: () => {},
  helpPage: 'jurnal-umum',
  setHelpPage: () => {},
});

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightTarget, setHighlightTarget] = useState<string | null>(null);
  const [helpPage, setHelpPage] = useState('jurnal-umum');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const setHighlight = useCallback((target: string | null) => {
    setHighlightTarget(target);
    if (target) {
      // Find element and focus + scroll
      setTimeout(() => {
        const el = document.querySelector(`[data-help-target="${target}"]`) as HTMLElement;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 100);
      // Auto-clear highlight after 3 seconds
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHighlightTarget(null), 3000);
    }
  }, []);

  // Clear highlight on escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && highlightTarget) {
        setHighlightTarget(null);
        clearTimeout(timerRef.current);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [highlightTarget]);

  return (
    <HelpContext.Provider value={{
      isOpen,
      openHelp: () => setIsOpen(true),
      closeHelp: () => setIsOpen(false),
      toggleHelp: () => setIsOpen(p => !p),
      highlightTarget,
      setHighlight,
      helpPage,
      setHelpPage,
    }}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  return useContext(HelpContext);
}

// ─── HelpLink component — clickable text that triggers highlight ───
export function HelpLink({ target, children }: { target: string; children: React.ReactNode }) {
  const { setHighlight } = useHelp();
  return (
    <button
      type="button"
      onClick={() => setHighlight(target)}
      className="inline font-semibold text-emerald-600 hover:text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:decoration-emerald-500 transition cursor-pointer bg-emerald-50/50 px-1 rounded"
    >
      {children}
    </button>
  );
}

// ─── Hook to apply highlight glow on target elements ───
export function useHelpHighlight(targetName: string): { 'data-help-target': string; className: string } {
  const { highlightTarget } = useHelp();
  return {
    'data-help-target': targetName,
    className: highlightTarget === targetName ? 'help-glow' : '',
  };
}
