import { useEffect } from 'react';
import { markOpened } from '../lib/storage';

// Records the lesson as "where you left off" when the page opens.
export default function LessonTracker({ course, lesson }: { course: string; lesson: string }) {
  useEffect(() => markOpened(course, lesson), [course, lesson]);
  return null;
}
