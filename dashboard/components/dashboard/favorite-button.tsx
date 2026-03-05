"use client";

import { useState, useEffect } from "react";
import { toggleFavorite } from "@/lib/favorite-actions";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  businessId: number;
  isFavorited: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function FavoriteButton({
  businessId,
  isFavorited,
  size = "sm",
  className,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(isFavorited);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setFavorited(isFavorited);
  }, [isFavorited]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPending(true);
    const prev = favorited;
    setFavorited(!prev);
    try {
      const result = await toggleFavorite(businessId);
      setFavorited(result.favorited);
    } catch {
      setFavorited(prev);
    } finally {
      setPending(false);
    }
  };

  const dim = size === "sm" ? "size-4" : "size-5";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-colors focus:outline-none",
        pending && "opacity-50",
        className
      )}
    >
      <svg
        className={cn(
          dim,
          "transition-colors",
          favorited
            ? "fill-amber-400 text-amber-400"
            : "fill-none text-muted-foreground hover:text-amber-400"
        )}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
        />
      </svg>
    </button>
  );
}
