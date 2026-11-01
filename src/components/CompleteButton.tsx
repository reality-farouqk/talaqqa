import { toggleDone, useStore } from '../lib/storage';

export default function CompleteButton({ lessonKey }: { lessonKey: string }) {
  const s = useStore();
  const done = !!s?.done.includes(lessonKey);
  return (
    <button type="button" className={done ? 'btn' : 'btn ghost'} onClick={() => toggleDone(lessonKey)} aria-pressed={done} disabled={!s}>
      {done ? '✓ Completed' : 'Mark as complete'}
    </button>
  );
}
