export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileEntry[];
}

export interface NoteState {
  path: string;
  content: string;
  modified: boolean;
  lastSaved: number | null;
}
