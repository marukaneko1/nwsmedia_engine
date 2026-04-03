import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import type { Course, Module, Slide, ContentBlock, QuizQuestion } from '../../data/vaTrainingCourse';

type CourseProgress = {
  currentModule: number;
  currentSlide: number;
  moduleScores: Record<string, number>;
  completedModules: string[];
};

function loadProgress(courseId: string, userId: string): CourseProgress {
  try {
    const raw = localStorage.getItem(`course_progress_${courseId}_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { currentModule: 0, currentSlide: 0, moduleScores: {}, completedModules: [] };
}

function saveProgress(courseId: string, userId: string, progress: CourseProgress) {
  localStorage.setItem(`course_progress_${courseId}_${userId}`, JSON.stringify(progress));
  api.post('/training/course-progress', { courseId, progress }).catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════
   Content Block Renderer
   ═══════════════════════════════════════════════════════════════ */

function ContentBlockView({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'text':
      return <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{block.content}</p>;

    case 'heading':
      return <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-4">{block.content}</h3>;

    case 'subheading':
      return <h4 className="text-base font-semibold text-neutral-800 dark:text-white mt-3">{block.content}</h4>;

    case 'bullets':
      return (
        <ul className="space-y-2 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-gray-700 dark:text-gray-300 leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-800" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case 'callout': {
      const styles = {
        info: 'bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-200',
        warning: 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200',
        tip: 'bg-green-50 border-green-300 text-green-900 dark:bg-green-900/20 dark:border-green-700 dark:text-green-200',
        important: 'bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-200',
      };
      const icons = { info: 'ℹ️', warning: '⚠️', tip: '💡', important: '⭐' };
      return (
        <div className={`rounded-xl border-l-4 px-5 py-4 ${styles[block.variant]}`}>
          <span className="mr-2">{icons[block.variant]}</span>
          <span className="font-medium leading-relaxed">{block.content}</span>
        </div>
      );
    }

    case 'script':
      return (
        <div className="rounded-xl bg-gray-900 dark:bg-[#0a0a0a] p-5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{block.label}</p>
          <p className="text-green-400 leading-relaxed italic font-medium">{block.content}</p>
        </div>
      );

    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-[#1a1a1a]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#0a0a0a]">
                {block.headers.map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {block.rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#111]/50">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-4 py-3 text-gray-700 dark:text-gray-300 ${j === 0 ? 'font-medium' : ''}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'comparison':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border-2 border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400 mb-3">✓ DO THIS</p>
            <ul className="space-y-2">
              {block.doItems.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-green-800 dark:text-green-300">
                  <span className="shrink-0 text-green-600">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border-2 border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400 mb-3">✗ NEVER DO THIS</p>
            <ul className="space-y-2">
              {block.dontItems.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-red-800 dark:text-red-300">
                  <span className="shrink-0 text-red-600">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );

    default:
      return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Slide View
   ═══════════════════════════════════════════════════════════════ */

function SlideView({ slide, slideNum, totalSlides }: { slide: Slide; slideNum: number; totalSlides: number }) {
  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
          Slide {slideNum} of {totalSlides}
        </p>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{slide.title}</h2>
        {slide.subtitle && <p className="mt-1 text-base text-gray-500 dark:text-gray-400">{slide.subtitle}</p>}
      </div>
      <div className="space-y-5">
        {slide.content.map((block, i) => (
          <ContentBlockView key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Quiz View
   ═══════════════════════════════════════════════════════════════ */

function QuizView({ questions, moduleTitle, onComplete }: {
  questions: QuizQuestion[];
  moduleTitle: string;
  onComplete: (score: number) => void;
}) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[currentQ];
  const isCorrect = selected === q?.correctIndex;

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === q.correctIndex) setCorrect(c => c + 1);
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      setFinished(true);
      const finalScore = selected === q.correctIndex ? correct : correct;
      onComplete(Math.round((finalScore / questions.length) * 100));
    }
  };

  if (finished) {
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= 70;
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-fadeIn">
        <div className={`h-24 w-24 rounded-full flex items-center justify-center text-4xl mb-6 ${passed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
          {passed ? '🎉' : '📚'}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {passed ? 'Great Job!' : 'Almost There!'}
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-1">
          Quiz: {moduleTitle}
        </p>
        <p className={`text-3xl font-bold mt-4 ${passed ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {correct}/{questions.length} correct ({score}%)
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {passed ? 'You passed! Move on to the next module.' : 'You need 70% to pass. Review the material and try again.'}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-white mb-1">
          Quiz — Question {currentQ + 1} of {questions.length}
        </p>
        <div className="flex gap-1.5 mb-4">
          {questions.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < currentQ ? 'bg-neutral-800' : i === currentQ ? 'bg-brand-400' : 'bg-gray-200 dark:bg-[#111]'
            }`} />
          ))}
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{q.question}</h2>
      </div>

      <div className="space-y-3">
        {q.options.map((opt, i) => {
          let cls = 'border-gray-200 dark:border-[#1a1a1a] hover:border-brand-400 dark:hover:border-neutral-500 cursor-pointer';
          if (answered) {
            if (i === q.correctIndex) cls = 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600';
            else if (i === selected) cls = 'border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-600';
            else cls = 'border-gray-200 dark:border-[#1a1a1a] opacity-50';
          } else if (i === selected) {
            cls = 'border-neutral-500 bg-neutral-50 dark:bg-[#111] dark:border-brand-400';
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={answered}
              className={`w-full text-left rounded-xl border-2 px-5 py-4 transition-all ${cls}`}
            >
              <div className="flex items-start gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  answered && i === q.correctIndex ? 'border-green-500 bg-green-500 text-white' :
                  answered && i === selected ? 'border-red-500 bg-red-500 text-white' :
                  'border-gray-300 dark:border-[#262626] text-gray-500 dark:text-gray-400'
                }`}>
                  {answered && i === q.correctIndex ? '✓' : answered && i === selected ? '✗' : String.fromCharCode(65 + i)}
                </span>
                <span className="text-gray-800 dark:text-gray-200 font-medium">{opt}</span>
              </div>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={`mt-5 rounded-xl p-4 ${isCorrect ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'}`}>
          <p className={`text-sm font-semibold ${isCorrect ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
            {isCorrect ? '✓ Correct!' : '✗ Not quite.'}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{q.explanation}</p>
        </div>
      )}

      {answered && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleNext}
            className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
          >
            {currentQ < questions.length - 1 ? 'Next Question' : 'See Results'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Course Component
   ═══════════════════════════════════════════════════════════════ */

export function TrainingCourse({ course }: { course: Course }) {
  const { user } = useAuth();
  const [progress, setProgress] = useState<CourseProgress>(() =>
    loadProgress(course.id, user?.id ?? 'anon')
  );
  const [showQuiz, setShowQuiz] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const mod = course.modules[progress.currentModule];
  const slide = mod?.slides[progress.currentSlide];
  const totalSlides = mod?.slides.length ?? 0;
  const totalModules = course.modules.length;

  const totalSlidesAll = course.modules.reduce((s, m) => s + m.slides.length, 0);
  const completedSlides = course.modules.slice(0, progress.currentModule).reduce((s, m) => s + m.slides.length, 0) + progress.currentSlide;
  const overallProgress = Math.round((completedSlides / totalSlidesAll) * 100);
  const allDone = progress.completedModules.length === totalModules;

  const persist = useCallback((p: CourseProgress) => {
    setProgress(p);
    saveProgress(course.id, user?.id ?? 'anon', p);
  }, [course.id, user?.id]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [progress.currentModule, progress.currentSlide, showQuiz]);

  const goToSlide = (modIdx: number, slideIdx: number) => {
    setShowQuiz(false);
    persist({ ...progress, currentModule: modIdx, currentSlide: slideIdx });
  };

  const nextSlide = () => {
    if (progress.currentSlide < totalSlides - 1) {
      persist({ ...progress, currentSlide: progress.currentSlide + 1 });
    } else {
      setShowQuiz(true);
    }
  };

  const prevSlide = () => {
    if (showQuiz) {
      setShowQuiz(false);
      return;
    }
    if (progress.currentSlide > 0) {
      persist({ ...progress, currentSlide: progress.currentSlide - 1 });
    } else if (progress.currentModule > 0) {
      const prevMod = course.modules[progress.currentModule - 1];
      persist({ ...progress, currentModule: progress.currentModule - 1, currentSlide: prevMod.slides.length - 1 });
    }
  };

  const onQuizComplete = (score: number) => {
    const updated = { ...progress };
    updated.moduleScores[mod.id] = score;
    if (score >= 70 && !updated.completedModules.includes(mod.id)) {
      updated.completedModules.push(mod.id);
    }
    persist(updated);
  };

  const nextModule = () => {
    if (progress.currentModule < totalModules - 1) {
      setShowQuiz(false);
      persist({ ...progress, currentModule: progress.currentModule + 1, currentSlide: 0 });
    }
  };

  const retryQuiz = () => {
    setShowQuiz(true);
  };

  const isModuleCompleted = (modId: string) => progress.completedModules.includes(modId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && !showQuiz) nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} shrink-0 overflow-hidden transition-all duration-300 border-r border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-black`}>
        <div className="w-72 h-full flex flex-col">
          <div className="p-5 border-b border-gray-200 dark:border-[#1a1a1a]">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{course.title}</h2>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-[#111] overflow-hidden">
                <div className="h-full rounded-full bg-neutral-800 transition-all duration-500" style={{ width: `${allDone ? 100 : overallProgress}%` }} />
              </div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{allDone ? 100 : overallProgress}%</span>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {course.modules.map((m, mi) => {
              const isActive = mi === progress.currentModule;
              const done = isModuleCompleted(m.id);
              const score = progress.moduleScores[m.id];
              return (
                <button
                  key={m.id}
                  onClick={() => goToSlide(mi, 0)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                    isActive
                      ? 'bg-neutral-50 dark:bg-[#111]'
                      : 'hover:bg-gray-50 dark:hover:bg-[#111]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done ? 'bg-green-500 text-white' : isActive ? 'bg-neutral-800 text-white' : 'bg-gray-200 dark:bg-[#111] text-gray-500 dark:text-gray-400'
                    }`}>
                      {done ? '✓' : mi + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-neutral-800 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                        {m.title}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{m.slides.length} slides</p>
                      {score != null && (
                        <p className={`text-xs font-semibold ${score >= 70 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          Quiz: {score}%
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-black px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-[#111] dark:hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Module {progress.currentModule + 1}: {mod?.title}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{mod?.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showQuiz && (
              <div className="flex gap-1">
                {Array.from({ length: totalSlides + 1 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-6 rounded-full transition-colors ${
                      (i < progress.currentSlide) || (i === totalSlides && showQuiz)
                        ? 'bg-neutral-800'
                        : (i === progress.currentSlide && !showQuiz) || (i === totalSlides && showQuiz)
                          ? 'bg-brand-400'
                          : 'bg-gray-200 dark:bg-[#111]'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Slide / Quiz content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-8 py-8">
            {showQuiz ? (
              <>
                <QuizView
                  key={`quiz-${mod.id}-${progress.moduleScores[mod.id] ?? 'new'}`}
                  questions={mod.quiz}
                  moduleTitle={mod.title}
                  onComplete={onQuizComplete}
                />
                {progress.moduleScores[mod.id] != null && (
                  <div className="mt-6 flex justify-center gap-4">
                    {(progress.moduleScores[mod.id] ?? 0) < 70 && (
                      <button
                        onClick={retryQuiz}
                        className="rounded-lg border border-gray-300 dark:border-[#262626] px-6 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111] transition-colors"
                      >
                        Retry Quiz
                      </button>
                    )}
                    {(progress.moduleScores[mod.id] ?? 0) >= 70 && progress.currentModule < totalModules - 1 && (
                      <button
                        onClick={nextModule}
                        className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
                      >
                        Next Module →
                      </button>
                    )}
                    {allDone && (
                      <div className="text-center">
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">🎓 Course Complete!</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You\'ve completed all modules and quizzes.</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : slide ? (
              <SlideView slide={slide} slideNum={progress.currentSlide + 1} totalSlides={totalSlides} />
            ) : null}
          </div>
        </div>

        {/* Bottom nav */}
        {!showQuiz && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-black px-6 py-3">
            <button
              onClick={prevSlide}
              disabled={progress.currentModule === 0 && progress.currentSlide === 0}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#111] disabled:opacity-30 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Use ← → arrow keys to navigate
            </p>
            <button
              onClick={nextSlide}
              className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors"
            >
              {progress.currentSlide === totalSlides - 1 ? 'Take Quiz' : 'Next'}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
