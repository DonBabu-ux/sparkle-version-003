import React from 'react';
import Skeleton from './Skeleton';

/**
 * Structure-accurate loading skeletons.
 *
 * Every component here mirrors the REAL card/row it stands in for
 * (container shell, header, body, media block, action row) so users
 * can predict what loads. Do not replace these with plain boxes —
 * that tells the user nothing about the content.
 */

/** Mirrors PostCard: header (avatar + name/time + menu), body, media, actions. */
export const PostCardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="mb-3 rounded-none border-b border-black/5 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-zinc-900 sm:rounded-[12px] sm:border"
      >
        {/* Header: avatar + name/meta + menu */}
        <div className="flex items-start gap-2 pb-1.5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        {/* Body */}
        <div className="space-y-2 px-1 pb-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        {/* Media */}
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
        {/* Actions */}
        <div className="flex items-center justify-around px-2 py-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    ))}
  </>
);

/** Mirrors a marketplace ListingCard: media, title/price, meta, actions. */
export const ListingCardSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-800"
      >
        <Skeleton className="aspect-[16/10] w-full rounded-none" />
        <div className="space-y-3 p-6">
          <div className="flex items-start justify-between gap-4">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Skeleton className="h-10 rounded-2xl" />
            <Skeleton className="h-10 rounded-2xl" />
          </div>
        </div>
      </div>
    ))}
  </>
);

/** Mirrors a circle card: accent line, icon, name, description, meta. */
export const GroupCardSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="relative flex flex-col overflow-hidden rounded-3xl border border-[#e6d8e1] bg-[#fdf8fa] p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
      >
        <div className="absolute left-6 right-6 top-0 h-0.5 rounded-b bg-[#ff1493]/30" />
        <div className="mb-4 flex items-start gap-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-[18px]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
        <Skeleton className="h-10 w-28 rounded-2xl" />
      </div>
    ))}
  </>
);

/** Mirrors an event card: media block, title, date/location, meta row. */
export const EventCardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="flex gap-4 rounded-3xl border border-[#e6d8e1] bg-[#f6eef3] p-4 dark:border-zinc-700 dark:bg-zinc-800"
      >
        <Skeleton className="h-24 w-24 shrink-0 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    ))}
  </>
);

/** Mirrors a person row: avatar, name, handle, action button. */
export const UserRowSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3">
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <Skeleton className="h-8 w-20 rounded-xl" />
      </div>
    ))}
  </>
);

/** Mirrors a notification row: avatar, two text bars, timestamp. */
export const NotificationRowSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
        <Skeleton className="h-2.5 w-8" />
      </div>
    ))}
  </>
);

/** Mirrors a poll card: question, option rows, meta bar. */
export const PollCardSkeleton: React.FC<{ count?: number }> = ({ count = 2 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="space-y-4 rounded-3xl border border-[#e6d8e1] bg-[#fdf8fa] p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex gap-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/4" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-5 w-3/4" />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    ))}
  </>
);

/** Mirrors a reel tile: 9:16 media with overlay bars. */
export const ReelTileSkeleton: React.FC = () => (
  <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-zinc-900">
    <div className="absolute inset-x-0 bottom-0 space-y-2 p-3">
      <Skeleton className="h-3 w-24 rounded-full" />
      <Skeleton className="h-3 w-40 rounded-full" />
    </div>
  </div>
);

export default {
  PostCardSkeleton,
  ListingCardSkeleton,
  GroupCardSkeleton,
  EventCardSkeleton,
  UserRowSkeleton,
  NotificationRowSkeleton,
  PollCardSkeleton,
  ReelTileSkeleton,
};