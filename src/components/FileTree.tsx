import React, { useState, useCallback, createContext, useContext } from 'react';
import { FileEntry } from '../lib/types';
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

// Global expand/collapse signal
interface TreeControl {
  expandAll: number;   // increment to trigger expand
  collapseAll: number; // increment to trigger collapse
}

const TreeControlContext = createContext<TreeControl>({ expandAll: 0, collapseAll: 0 });

interface FileTreeProps {
  entries: FileEntry[];
  onFileSelect: (path: string) => void;
  activeFile: string | null;
}

interface FileNodeProps {
  entry: FileEntry;
  depth: number;
  onFileSelect: (path: string) => void;
  activeFile: string | null;
}

const FileNode: React.FC<FileNodeProps> = ({ entry, depth, onFileSelect, activeFile }) => {
  const [expanded, setExpanded] = useState(false);
  const control = useContext(TreeControlContext);

  // React to global expand/collapse signals
  React.useEffect(() => {
    if (control.expandAll > 0) setExpanded(true);
  }, [control.expandAll]);

  React.useEffect(() => {
    if (control.collapseAll > 0) setExpanded(false);
  }, [control.collapseAll]);

  if (entry.is_dir) {
    const childCount = entry.children?.length || 0;

    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1.5 py-1 px-2 text-left hover:bg-forge-steel/50 transition-colors group"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown size={12} className="text-gray-600 shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-gray-600 shrink-0" />
          )}
          {expanded ? (
            <FolderOpen size={14} className="text-forge-ember/60 shrink-0" />
          ) : (
            <Folder size={14} className="text-gray-500 shrink-0" />
          )}
          <span className="text-xs text-gray-400 truncate flex-1">{entry.name}</span>
          <span className="text-[9px] text-gray-700 shrink-0">{childCount}</span>
        </button>
        {expanded && entry.children && (
          <div>
            {entry.children.map((child) => (
              <FileNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                onFileSelect={onFileSelect}
                activeFile={activeFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = entry.path === activeFile;

  return (
    <button
      onClick={() => onFileSelect(entry.path)}
      className={`w-full flex items-center gap-1.5 py-1 px-2 text-left transition-colors ${
        isActive
          ? 'bg-forge-ember/10 text-forge-ember'
          : 'text-gray-400 hover:bg-forge-steel/50 hover:text-gray-300'
      }`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <FileText size={13} className={isActive ? 'text-forge-ember shrink-0' : 'text-gray-600 shrink-0'} />
      <span className="text-xs truncate">{entry.name.replace('.md', '')}</span>
    </button>
  );
};

const FileTree: React.FC<FileTreeProps> = ({ entries, onFileSelect, activeFile }) => {
  const [expandAll, setExpandAll] = useState(0);
  const [collapseAll, setCollapseAll] = useState(0);

  if (entries.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest">Empty vault</p>
      </div>
    );
  }

  return (
    <TreeControlContext.Provider value={{ expandAll, collapseAll }}>
      {/* Tree controls */}
      <div className="flex items-center justify-end gap-1 px-3 py-1 border-b border-forge-steel/30">
        <button
          onClick={() => setExpandAll(prev => prev + 1)}
          className="text-gray-700 hover:text-gray-400 transition-colors"
          title="Expand all folders"
        >
          <ChevronsUpDown size={12} />
        </button>
        <button
          onClick={() => setCollapseAll(prev => prev + 1)}
          className="text-gray-700 hover:text-gray-400 transition-colors"
          title="Collapse all folders"
        >
          <ChevronsDownUp size={12} />
        </button>
      </div>

      <div className="py-1">
        {entries.map((entry) => (
          <FileNode
            key={entry.path}
            entry={entry}
            depth={0}
            onFileSelect={onFileSelect}
            activeFile={activeFile}
          />
        ))}
      </div>
    </TreeControlContext.Provider>
  );
};

export default FileTree;
