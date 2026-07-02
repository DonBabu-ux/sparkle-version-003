import React from 'react';
import { Link } from 'react-router-dom';
import type { NotificationEntity } from '../types/notification';

/**
 * Safely renders a notification body with interactive entity links.
 * Avoids dangerouslySetInnerHTML, markdown parsing, and HTML parsing.
 * 
 * Splits the body text by the exact entity texts and replaces them with Link components.
 */
export const renderRichText = (body: string, entities: NotificationEntity[]): React.ReactNode => {
  if (!entities || entities.length === 0) {
    return <span>{body}</span>;
  }

  // Build a regular expression to match any of the entity texts (escaped)
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Sort entities by text length descending so longer matches take precedence
  const sortedEntities = [...entities].sort((a, b) => b.text.length - a.text.length);
  const pattern = sortedEntities.map(e => `(${escapeRegExp(e.text)})`).join('|');
  
  if (!pattern) {
    return <span>{body}</span>;
  }

  const regex = new RegExp(pattern, 'g');
  const parts = body.split(regex);

  // Map each split part to either plain text or a link
  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        // Check if this part matches any entity text
        const entity = entities.find(e => e.text === part);
        if (entity) {
          let route = '/';
          switch (entity.type) {
            case 'user':
              route = `/profile/${entity.id}`;
              break;
            case 'group':
              route = `/groups/${entity.id}`;
              break;
            case 'post':
              route = `/posts/${entity.id}`;
              break;
            case 'hashtag':
              route = `/hashtag/${encodeURIComponent(entity.text.replace('#', ''))}`;
              break;
          }

          return (
            <Link
              key={index}
              to={route}
              className="font-bold text-pink-600 hover:underline transition-colors duration-150 inline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </>
  );
};
