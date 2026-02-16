import React, { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { PromotedBlock } from './PromotedBlockExtension';
import EditorToolbar from './EditorToolbar';
import { markdownToHtml, tiptapJsonToMarkdown } from '../../lib/markdown';
import { invoke } from '@tauri-apps/api/core';
import { Save } from 'lucide-react';

interface ForgeEditorProps {
  filePath: string | null;
  onContentChange?: (modified: boolean) => void;
}

const ForgeEditor: React.FC<ForgeEditorProps> = ({ filePath, onContentChange }) => {
  const saveTimeoutRef = useRef<number | null>(null);
  const lastSavedRef = useRef<string>('');
  const isLoadingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // We handle our own heading parsing
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return 'Heading...';
          }
          return 'Start writing. Use ⚡ to promote a block.';
        },
      }),
      PromotedBlock,
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: 'forge-editor-content',
      },
    },
    onUpdate: ({ editor }) => {
      if (isLoadingRef.current) return;
      
      onContentChange?.(true);

      // Debounced autosave (2 seconds)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        saveCurrentFile(editor);
      }, 2000);
    },
  });

  // Load file content when filePath changes
  useEffect(() => {
    if (!filePath || !editor) return;

    isLoadingRef.current = true;

    invoke<string>('read_note', { path: filePath })
      .then((content) => {
        const html = markdownToHtml(content);
        editor.commands.setContent(html);
        lastSavedRef.current = content;
        onContentChange?.(false);
      })
      .catch((err) => {
        console.error('Failed to load file:', err);
        editor.commands.setContent(`<p>Error loading file: ${err}</p>`);
      })
      .finally(() => {
        // Small delay to prevent the onUpdate from firing during load
        setTimeout(() => {
          isLoadingRef.current = false;
        }, 100);
      });
  }, [filePath, editor]);

  const saveCurrentFile = useCallback(
    async (editorInstance?: typeof editor) => {
      const ed = editorInstance || editor;
      if (!filePath || !ed) return;

      const json = ed.getJSON();
      const markdown = tiptapJsonToMarkdown(json);

      // Don't save if content hasn't changed
      if (markdown === lastSavedRef.current) return;

      try {
        await invoke('write_note', { path: filePath, content: markdown });
        lastSavedRef.current = markdown;
        onContentChange?.(false);
      } catch (err) {
        console.error('Failed to save:', err);
      }
    },
    [filePath, editor]
  );

  // Ctrl+S manual save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveCurrentFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveCurrentFile]);

  // Cleanup autosave timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!filePath) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6 opacity-20">⚒️</div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight uppercase italic">
            The Workshop
          </h2>
          <div className="h-1 w-24 bg-forge-ember mx-auto rounded-full mb-6"></div>
          <p className="text-gray-500 text-sm">
            Select a note from the vault, or create a new one.
          </p>
          <p className="text-gray-600 text-xs mt-4 font-mono">
            Ctrl+Shift+P to promote a block · Ctrl+S to save
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#1a1a1a] overflow-hidden">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-forge-steel bg-forge-iron/50">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-mono truncate max-w-[400px]">
            {filePath.split(/[\\/]/).pop()}
          </span>
        </div>
        <button
          onClick={() => saveCurrentFile()}
          className="text-gray-500 hover:text-forge-ember transition-colors"
          title="Save (Ctrl+S)"
        >
          <Save size={14} />
        </button>
      </div>

      {/* Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-8 px-6">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
};

export default ForgeEditor;
