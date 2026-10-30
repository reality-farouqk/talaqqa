import { useEffect } from 'react';
import { useStore } from '../lib/storage';

// Adds a "done" state to static lesson links that carry data-lesson-key.
export default function LessonChecks() {
  const s = useStore();
  useEffect(() => {
    if (!s) return;
    document.querySelectorAll<HTMLElement>('[data-lesson-key]').forEach((el) => {
      const done = s.done.includes(el.dataset.lessonKey!);
      el.classList.toggle('is-done', done);
      const sr = el.querySelector('.sr-status');
      if (sr) sr.textContent = done ? ' (completed)' : '';
    });
  }, [s]);
  return null;
}
