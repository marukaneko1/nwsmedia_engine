import { useState, useEffect } from 'react';
import { TrainingCourse } from './TrainingCourse';
import { VA_TRAINING_COURSE } from '../../data/vaTrainingCourse';
import { api } from '../../utils/api';
import type { Course } from '../../data/vaTrainingCourse';

export function VACourseWrapper() {
  const [course, setCourse] = useState<Course>(VA_TRAINING_COURSE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ course: { content: Course['modules']; title: string; description: string; slug: string } }>('/training/courses/va-cold-caller-onboarding')
      .then((res) => {
        if (res.course && res.course.content?.length > 0) {
          setCourse({
            id: res.course.slug,
            title: res.course.title,
            description: res.course.description,
            modules: res.course.content,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return <TrainingCourse course={course} />;
}
