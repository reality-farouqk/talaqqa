import { useEffect, useRef, useState } from 'react';
import { createPlaylist, saveNote, togglePlaylistItem, toggleSavedLesson, useStore } from '../lib/storage';

// Save for later, add to playlist and private notes for one lesson. All stored on the device.
export default function LessonTools({ lessonKey }: { lessonKey: string }) {
  const s = useStore();
  const [panel, setPanel] = useState<'playlists' | 'notes' | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [note, setNote] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    if (s && !loaded.current) { setNote(s.notes[lessonKey] ?? ''); loaded.current = true; }
  }, [s, lessonKey]);
  // Save notes shortly after typing stops.
  useEffect(() => {
    if (!loaded.current) return;
    const t = window.setTimeout(() => saveNote(lessonKey, note), 500);
    return () => window.clearTimeout(t);
  }, [note, lessonKey]);

  if (!s) return null;
  const saved = s.savedLessons.includes(lessonKey);
  const inLists = s.playlists.filter((p) => p.items.includes(lessonKey)).length;
  const toggle = (p: 'playlists' | 'notes') => setPanel(panel === p ? null : p);

  return (
    <div className="tools">
      <div className="actions" style={{ margin: 0 }}>
        <button type="button" className={saved ? 'btn' : 'btn ghost'} aria-pressed={saved} onClick={() => toggleSavedLesson(lessonKey)}>{saved ? '✓ Saved' : 'Watch later'}</button>
        <button type="button" className="btn ghost" aria-expanded={panel === 'playlists'} onClick={() => toggle('playlists')}>＋ Playlist{inLists > 0 && ` (${inLists})`}</button>
        <button type="button" className="btn ghost" aria-expanded={panel === 'notes'} onClick={() => toggle('notes')}>Notes{s.notes[lessonKey] && ' •'}</button>
      </div>
      {panel === 'playlists' && (
        <div className="panel">
          {s.playlists.map((p) => (
            <label key={p.id} className="check"><input type="checkbox" checked={p.items.includes(lessonKey)} onChange={() => togglePlaylistItem(p.id, lessonKey)} /> {p.title}</label>
          ))}
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (newTitle.trim()) { createPlaylist(newTitle, lessonKey); setNewTitle(''); } }}>
            <label htmlFor="new-pl" className="sr-only">New playlist name</label>
            <input id="new-pl" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New playlist" maxLength={120} />
            <button type="submit" className="btn">Create</button>
          </form>
        </div>
      )}
      {panel === 'notes' && (
        <div className="panel">
          <label htmlFor="notes" className="sr-only">Your notes for this lesson</label>
          <textarea id="notes" rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Your notes, saved on this device" maxLength={20000} dir="auto" />
        </div>
      )}
    </div>
  );
}
