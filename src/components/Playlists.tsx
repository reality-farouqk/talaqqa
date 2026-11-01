import { useEffect, useState } from 'react';
import { createPlaylist, deletePlaylist, movePlaylistItem, renamePlaylist, setPlaylistVisibility, togglePlaylistItem, useStore } from '../lib/storage';
import { findLesson, thumb, useCatalog } from '../lib/catalog';

// Playlists live on this device until accounts arrive; "public" sharing needs an account, so it is shown but disabled.
export default function Playlists() {
  const s = useStore();
  const courses = useCatalog();
  const [openId, setOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => setOpenId(new URLSearchParams(location.search).get('id')), []);
  const open = (id: string | null) => {
    setOpenId(id); setConfirmDelete(false);
    history.replaceState(null, '', id ? `?id=${id}` : location.pathname);
  };
  if (!s || !courses) return <p className="meta">Loading…</p>;

  const list = s.playlists.find((p) => p.id === openId);
  if (!list) {
    return (
      <>
        <form className="row-form" onSubmit={(e) => { e.preventDefault(); if (title.trim()) { open(createPlaylist(title)); setTitle(''); } }}>
          <label htmlFor="pl-title" className="sr-only">New playlist name</label>
          <input id="pl-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New playlist name" maxLength={120} />
          <button type="submit" className="btn">Create</button>
        </form>
        {s.playlists.length ? (
          <ul className="pl-list">
            {s.playlists.map((p) => (
              <li key={p.id}><button type="button" className="pl-item" onClick={() => open(p.id)}><strong>{p.title}</strong><span className="meta">{p.items.length} {p.items.length === 1 ? 'lesson' : 'lessons'}</span></button></li>
            ))}
          </ul>
        ) : <p className="meta">No playlists yet. Create one here, or use “＋ Playlist” under any lesson.</p>}
      </>
    );
  }

  const items = list.items.map((key) => ({ key, found: findLesson(courses, key) }));
  return (
    <>
      <p><button type="button" className="linkish" onClick={() => open(null)}>← All playlists</button></p>
      <label htmlFor="pl-name" className="sr-only">Playlist name</label>
      <input id="pl-name" className="pl-name" defaultValue={list.title} key={list.id} onBlur={(e) => renamePlaylist(list.id, e.target.value)} maxLength={120} />
      <div className="actions">
        {items[0] && <a className="btn" href={`/courses/${items[0].key}/?list=${list.id}`}>▶ Play all</a>}
        <label className="check">Visibility{' '}
          <select value={list.visibility} onChange={(e) => setPlaylistVisibility(list.id, e.target.value as 'private' | 'public')}>
            <option value="private">Private</option>
            <option value="public" disabled>Public (needs sign-in, coming soon)</option>
          </select>
        </label>
      </div>
      {items.length ? (
        <ol className="lesson-list">
          {items.map(({ key, found }, i) => (
            <li key={key} className="pl-row">
              {found ? (
                <a href={`${found.url}?list=${list.id}`}>
                  {found.lesson.yt ? <img className="thumb" src={thumb(found.lesson.yt)} alt="" width={320} height={180} loading="lazy" /> : <span className="thumb thumb-empty" aria-hidden="true" />}
                  <span className="lt"><span dir="auto">{found.lesson.title}</span><br /><span className="meta" dir="auto">{found.course.title}</span></span>
                </a>
              ) : <span className="meta">This lesson is no longer available.</span>}
              <span className="pl-ctrl">
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => movePlaylistItem(list.id, i, i - 1)}>↑</button>
                <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => movePlaylistItem(list.id, i, i + 1)}>↓</button>
                <button type="button" aria-label="Remove from playlist" onClick={() => togglePlaylistItem(list.id, key)}>✕</button>
              </span>
            </li>
          ))}
        </ol>
      ) : <p className="meta">Empty. Add lessons with “＋ Playlist” under any video.</p>}
      <p className="actions">
        {confirmDelete ? (
          <>
            <button type="button" className="btn danger" onClick={() => { deletePlaylist(list.id); open(null); }}>Yes, delete playlist</button>
            <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </>
        ) : <button type="button" className="btn ghost" onClick={() => setConfirmDelete(true)}>Delete playlist</button>}
      </p>
    </>
  );
}
