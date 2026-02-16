import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Code, Heading1, Heading2, Heading3,
  List, Quote, Minus, Zap, Undo2, Redo2
} from 'lucide-react';
import { generateBlockId } from '../../lib/markdown';

interface EditorToolbarProps {
  editor: Editor | null;
}

const ToolbarButton: React.FC<{
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, active, disabled, title, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`toolbar-btn ${active ? 'toolbar-btn-active' : ''}`}
  >
    {children}
  </button>
);

const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  if (!editor) return null;

  const promoteBlock = () => {
    if (editor.isActive('promotedBlock')) {
      editor.commands.unsetPromotedBlock();
    } else {
      editor.commands.setPromotedBlock({
        blockId: generateBlockId(),
        blockType: 'claim',
      });
    }
  };

  return (
    <div className="editor-toolbar">
      <div className="toolbar-group">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={14} />
        </ToolbarButton>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 size={14} />
        </ToolbarButton>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Inline Code"
        >
          <Code size={14} />
        </ToolbarButton>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Blockquote"
        >
          <Quote size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus size={14} />
        </ToolbarButton>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton
          onClick={promoteBlock}
          active={editor.isActive('promotedBlock')}
          title="Promote to Block (Ctrl+Shift+P)"
        >
          <Zap size={14} />
          <span className="toolbar-label">Promote</span>
        </ToolbarButton>
      </div>
    </div>
  );
};

export default EditorToolbar;
