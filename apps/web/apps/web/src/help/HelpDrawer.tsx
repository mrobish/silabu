import React from 'react';
import { useLocation } from 'react-router-dom';
import { useHelp } from './HelpContext';
import { getHelpDoc } from '../content/help-docs';

export function HelpDrawer() {
  const { isDrawerOpen, closeDrawer } = useHelp();
  const location = useLocation();
  const doc = getHelpDoc(location.pathname);

  if (!isDrawerOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1099] transition-opacity"
        onClick={closeDrawer}
      />
      {/* Drawer Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl z-[1100] overflow-y-auto"
        style={{ animation: 'slide-in-right 0.3s ease-out' }}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {doc.title}
            </h2>
            <button
              onClick={closeDrawer}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              \u2715
            </button>
          </div>

          {/* Sections */}
          {doc.sections.map((section, i) => (
            <div key={i} className="mb-5">
              <h3 className="font-semibold text-slate-700 mb-2 text-sm">
                {section.icon} {section.title}
              </h3>
              <div className="text-sm text-slate-600 leading-relaxed pl-1">
                {section.content}
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              SILABU DIGI \u2014 Pusat Bantuan Interaktif
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
