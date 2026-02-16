import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Hammer, FolderOpen, Plus, RefreshCw, Search, Settings, Key, Check, X } from 'lucide-react';
import FileTree from './FileTree';
import { FileEntry } from '../lib/types';
import { getApiKey, setApiKey, hasApiKey } from '../lib/ai';

interface SidebarProps {
  onFileSelect: (path: string) => void;
  activeFile: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ onFileSelect, activeFile }) => {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  const [searchQuery, setSearchQuery] = useState('');
  const [vaultInput, setVaultInput] = useState('');
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySet, setApiKeySet] = useState(hasApiKey());

  const setVaultHandler = async (path: string) => {
    try {
      await invoke('set_vault', { path });
      setVaultPath(path);
      setShowVaultPicker(false);
      await refreshFiles();
    } catch (err) {
      console.error('Failed to set vault:', err);
    }
  };

  const refreshFiles = async () => {
    setLoading(true);
    try {
      const entries = await invoke<FileEntry[]>('get_vault_files');
      setFiles(entries);
    } catch (err) {
      console.error('Failed to list files:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectDb = async () => {
    try {
      const result = await invoke<string>('connect_db');
      setDbStatus('connected');
    } catch (err) {
      setDbStatus('error');
      console.error('DB connection failed:', err);
    }
  };

  const createNewFolder = async () => {
    if (!vaultPath) return;
    const name = prompt('Folder name:');
    if (!name) return;

    try {
      await invoke('create_folder', { path: name });
      await refreshFiles();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const createNewNote = async () => {
    if (!vaultPath) return;
    const name = prompt('Note name:');
    if (!name) return;
    const filename = name.endsWith('.md') ? name : `${name}.md`;
    try {
      const fullPath = await invoke<string>('create_note', { path: filename });
      await refreshFiles();
      onFileSelect(fullPath);
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      setApiKeySet(true);
      setApiKeyInput('');
    }
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('forge_anthropic_key');
    setApiKeySet(false);
    setApiKeyInput('');
  };

  // Auto-connect DB on mount
  useEffect(() => {
    connectDb();
  }, []);

  return (
    <div className="w-60 h-screen bg-forge-iron border-r border-forge-steel flex flex-col shrink-0 z-10">
      {/* Header */}
      <div className="p-4 border-b border-forge-steel">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-forge-ember tracking-tighter flex items-center gap-2">
            <Hammer size={18} />
            FORGE
          </h1>
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                dbStatus === 'connected'
                  ? 'bg-green-500'
                  : dbStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-gray-600'
              }`}
              title={`DB: ${dbStatus}`}
            />
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                apiKeySet ? 'bg-blue-500' : 'bg-gray-600'
              }`}
              title={`AI: ${apiKeySet ? 'configured' : 'no key'}`}
            />
          </div>
        </div>
        <p className="text-[10px] text-gray-600 uppercase tracking-widest">Logos Workshop</p>
      </div>

      {/* Vault section */}
      <div className="px-3 py-2 border-b border-forge-steel">
        {!vaultPath && !showVaultPicker ? (
          <button
            onClick={() => setShowVaultPicker(true)}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-forge-ember border border-dashed border-forge-steel rounded hover:border-forge-ember/50 transition-colors"
          >
            <FolderOpen size={14} />
            Open Vault
          </button>
        ) : showVaultPicker ? (
          <div className="space-y-2">
            <input
              type="text"
              value={vaultInput}
              onChange={(e) => setVaultInput(e.target.value)}
              placeholder="Vault path (e.g. O:\Theophysics_Data)"
              className="w-full bg-black/40 border border-forge-steel p-1.5 rounded text-xs outline-none focus:border-forge-ember transition-colors font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && vaultInput.trim()) {
                  setVaultHandler(vaultInput.trim());
                }
                if (e.key === 'Escape') {
                  setShowVaultPicker(false);
                }
              }}
              autoFocus
            />
            <div className="flex gap-1">
              <button
                onClick={() => vaultInput.trim() && setVaultHandler(vaultInput.trim())}
                className="flex-1 text-[10px] py-1 bg-forge-ember/20 text-forge-ember rounded hover:bg-forge-ember/30 transition-colors"
              >
                Open
              </button>
              <button
                onClick={() => setShowVaultPicker(false)}
                className="flex-1 text-[10px] py-1 bg-forge-steel text-gray-500 rounded hover:text-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowVaultPicker(true)}
              className="text-[10px] text-gray-500 font-mono truncate hover:text-gray-400 transition-colors"
              title={vaultPath || ''}
            >
              {vaultPath?.split(/[\\/]/).pop() || 'vault'}
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={createNewNote}
                className="text-gray-600 hover:text-forge-ember transition-colors"
                title="New note"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={refreshFiles}
                className="text-gray-600 hover:text-forge-ember transition-colors"
                title="Refresh"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      {vaultPath && (
        <div className="px-3 py-2 border-b border-forge-steel">
          <div className="relative">
            <Search className="absolute left-2 top-1.5 text-gray-600" size={12} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-black/30 border border-forge-steel/50 py-1 pl-6 pr-2 rounded text-[11px] outline-none focus:border-forge-ember/50 transition-colors"
            />
          </div>
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto">
        <FileTree entries={files} onFileSelect={onFileSelect} activeFile={activeFile} searchQuery={searchQuery} />
      </div>

      {/* Settings panel (slides up) */}
      {showSettings && (
        <div className="border-t border-forge-steel bg-forge-iron/95 px-3 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Settings</span>
            <button onClick={() => setShowSettings(false)} className="text-gray-600 hover:text-gray-400">
              <X size={12} />
            </button>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Key size={10} className="text-gray-500" />
              <span className="text-[10px] text-gray-500">Anthropic API Key</span>
            </div>
            {apiKeySet ? (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-green-500 flex items-center gap-1">
                  <Check size={10} /> Key configured
                </span>
                <button
                  onClick={handleClearApiKey}
                  className="text-[9px] text-red-400/60 hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-black/40 border border-forge-steel p-1.5 rounded text-[10px] outline-none focus:border-forge-ember transition-colors font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveApiKey();
                  }}
                />
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKeyInput.trim()}
                  className="w-full text-[10px] py-1 bg-forge-ember/20 text-forge-ember rounded hover:bg-forge-ember/30 transition-colors disabled:opacity-30"
                >
                  Save Key
                </button>
              </div>
            )}
          </div>

          {/* DB Status */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">Database</span>
              <span className={`text-[9px] ${
                dbStatus === 'connected' ? 'text-green-500' :
                dbStatus === 'error' ? 'text-red-400' : 'text-gray-600'
              }`}>
                {dbStatus}
              </span>
            </div>
            <div className="text-[9px] text-gray-700 font-mono">192.168.1.177:2665</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-forge-steel flex items-center justify-between">
        <div className="text-[9px] text-gray-700 font-mono tracking-widest uppercase">
          v0.2.0 · Phase 2
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`text-gray-600 hover:text-forge-ember transition-colors ${showSettings ? 'text-forge-ember' : ''}`}
          title="Settings"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;


