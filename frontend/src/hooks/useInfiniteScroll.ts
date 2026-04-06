import { useEffect, useCallback, useRef } from 'react';

interface UseInfiniteScrollProps {
  loading: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
  threshold?: number | number[];
}

export function useInfiniteScroll({
  loading,
  hasNextPage,
  onLoadMore,
  rootMargin = '400px',
  threshold = 0.1,
}: UseInfiniteScrollProps) {
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (loading) return;

      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage) {
            onLoadMore();
          }
        },
        { rootMargin, threshold }
      );

      if (node) observer.current.observe(node);
    },
    [loading, hasNextPage, onLoadMore, rootMargin, threshold]
  );

  return { lastElementRef };
}
