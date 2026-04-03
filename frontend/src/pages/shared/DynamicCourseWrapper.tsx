import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TrainingCourse } from './TrainingCourse';
import { api } from '../../utils/api';
import type { Course } from '../../data/vaTrainingCourse';

export function DynamicCourseWrapper() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.get<{ course: { content: Course['modules']; title: string; description: string; slug: string } }>(`/training/courses/${slug}`)
      .then((res) => {
        if (res.course && res.course.content?.length > 0) {
          setCourse({
            id: res.course.slug,
            title: res.course.title,
            description: res.course.description,
            modules: res.course.content,
          });
        } else {
          setError('Course has no content yet.');
        }
      })
      .catch(() => setError('Course not found.'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-gray-500 dark:text-gray-400">{error || 'Course not found.'}</p>
        <button onClick={() => navigate(-1)} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-black">
          Go Back
        </button>
      </div>
    );
  }

  return <TrainingCourse course={course} />;
}
