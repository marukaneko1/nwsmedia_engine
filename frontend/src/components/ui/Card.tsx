import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}

export function Card({ children, className = '', title, action }: CardProps) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#1a1a1a] dark:bg-[#0a0a0a] ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-[#1a1a1a]">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
