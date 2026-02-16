import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ForgeEditor from './components/Editor/ForgeEditor';
import AiPanel from './components/AiPanel';

function App() {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [modified, setModified] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  // Global keyboard shortcut: Ctrl+Shift+A toggles AI panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAiPanelOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen bg-[#1a1a1a] text-white overflow-hidden">
      <Sidebar onFileSelect={setActiveFile} activeFile={activeFile} />
      <ForgeEditor
        filePath={activeFile}
        onContentChange={setModified}
      />
      <AiPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        activeFile={activeFile}
      />

      {/* AI panel toggle button (fixed right edge) */}
      {!aiPanelOpen && (
        <button
          onClick={() => setAiPanelOpen(true)}
          className="ai-panel-toggle"
          title="Open AI Panel (Ctrl+Shift+A)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default App;
