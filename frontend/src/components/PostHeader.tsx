import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Shared post author header: avatar (→ profile) + name + secondary line.
 *
 * Renders as a fragment (avatar link + body column) so each call site keeps
 * its own header row container and any extra header content (menu triggers,
 * dropdown portals). Call sites pass their exact classes and behaviour:
 *  - PostCard (feed): Avatar component, title row with feeling/activity,
 *    follow action, time·privacy meta line.
 *  - PostDetail: plain heading name, avatar img, "@user • date" meta line.
 */
interface PostHeaderProps {
  /** Username used for the avatar/name profile links. */
  username?: string;
  /** Display name (call site resolves `name || username` itself). */
  name?: string;
  /** Avatar markup — each surface keeps its exact avatar element. */
  avatar?: ReactNode;
  /** Classes for the avatar's profile-link wrapper. */
  avatarClassName?: string;
  /** Classes for the body column beside the avatar. */
  bodyClassName?: string;
  /** Classes for the name element. */
  nameClassName?: string;
  /** Render the name as a plain <h3> instead of a profile link. */
  heading?: boolean;
  /** Wrap name + extras + follow in the feed's flex title row. */
  titleRow?: boolean;
  /** Inline nodes after the name (feeling/activity). */
  extras?: ReactNode;
  /** Render the "· Follow" action (feed only). */
  canFollow?: boolean;
  onFollow?: (e: MouseEvent) => void;
  /** Second line under the name (time · privacy icon / @user • date). */
  meta?: ReactNode;
}

export default function PostHeader({
  username,
  name,
  avatar,
  avatarClassName,
  bodyClassName,
  nameClassName,
  heading,
  titleRow,
  extras,
  canFollow,
  onFollow,
  meta,
}: PostHeaderProps) {
  const nameElement = heading ? (
    <h3 className={nameClassName}>{name}</h3>
  ) : (
    <Link to={`/profile/${username}`} className={nameClassName}>
      {name}
    </Link>
  );

  const followButton = canFollow && onFollow ? (
    <button onClick={onFollow} className="ml-0.5 text-[13px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
      · Follow
    </button>
  ) : null;

  return (
    <>
      <Link to={`/profile/${username}`} className={avatarClassName || undefined}>
        {avatar}
      </Link>

      <div className={bodyClassName || undefined}>
        {titleRow ? (
          <div className="flex items-center gap-1 flex-wrap leading-tight">
            {nameElement}
            {extras}
            {followButton}
          </div>
        ) : (
          <>
            {nameElement}
            {extras}
            {followButton}
          </>
        )}
        {meta}
      </div>
    </>
  );
}
