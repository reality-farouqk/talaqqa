import { useEffect, useState } from 'react';

const KEY = 'talaqqa:done';
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };

export default function CompleteButton({ lessonKey }: { lessonKey: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => setDone(read().includes(lessonKey)), [lessonKey]);
  const toggle = () => {
    const l = read(); const next = l.includes(lessonKey) ? l.filter((k) => k !== lessonKey) : [...l, lessonKey];
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    setDone(next.includes(lessonKey));
  };
  return <button className={done ? 'btn' : 'btn ghost'} onClick={toggle} aria-pressed={done}>{done ? 'Completed' : 'Mark as complete'}</button>;
}
