import { toggleDone, useStore } from '../lib/storage';
import Icon from './Icon';

export default function CompleteButton({ lessonKey }: { lessonKey: string }) {
  const s = useStore();
  const done = !!s?.done.includes(lessonKey);
  return (
    <button type="button" className="chip-btn" onClick={() => toggleDone(lessonKey)} aria-pressed={done} disabled={!s}>
      <Icon name="check" /> {done ? 'Completed' : 'Mark complete'}
    </button>
  );
}
