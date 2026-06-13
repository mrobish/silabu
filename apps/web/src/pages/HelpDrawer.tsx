import { useHelp } from './HelpContext';
import { getHelpDoc } from '../content/help-docs';

export default function HelpDrawer() {
  const { isOpen, closeHelp, helpPage } = useHelp();
  const doc = getHelpDoc(helpPage);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[150] bg-black/20 backdrop-blur-sm" onClick={closeHelp} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-[150] w-full max-w-md bg-white shadow-2xl border-l border-slate-200 animate-slide-in-right overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-cyan-50">
          <h3 className="text-base font-bold text-slate-900">{doc.title}</h3>
          <button type="button" onClick={closeHelp}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/60 transition text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {doc.sections.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Panduan untuk halaman ini belum tersedia.</p>
          ) : (
            doc.sections.map((section, i) => (
              <div key={i}>
                <h4 className="font-bold text-slate-900 text-sm mb-2">
                  {section.icon} {section.title}
                </h4>
                <div className="text-sm text-slate-600 leading-relaxed">
                  {section.content}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[11px] text-slate-400 text-center">
            SILABU DIGI — Pusat Bantuan Interaktif
          </p>
        </div>
      </div>
    </>
  );
}
