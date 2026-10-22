import { EVENT_FORMATS, EVENT_SOURCES, EVENT_TYPES } from '@itnews/shared';
import type { TechEvent } from '@itnews/shared';
import type { CSSProperties } from 'react';
import { formatEventDate, formatParticipants } from '../lib/format';
import { TagList } from './TagList';

export function EventCard({ event }: { event: TechEvent }) {
  const date = formatEventDate(event.startAt, event.endAt);
  const participants = formatParticipants(event.capacity, event.accepted);
  const place = event.format === 'online' ? 'オンライン' : event.venue;
  return (
    <article className="card event-card">
      <time className="event-card__date" dateTime={event.startAt} aria-hidden="true">
        <span className="event-card__month">{date.month}月</span>
        <span className="event-card__day">{date.day}</span>
        <span className="event-card__weekday">{date.weekday}</span>
      </time>
      <div className="event-card__body">
        <div className="badges">
          <span
            className="badge"
            style={{ '--badge-color': EVENT_TYPES[event.type].color } as CSSProperties}
          >
            {EVENT_TYPES[event.type].label}
          </span>
          <span
            className="badge"
            style={{ '--badge-color': EVENT_FORMATS[event.format].color } as CSSProperties}
          >
            {EVENT_FORMATS[event.format].label}
          </span>
        </div>
        <h2 className="card__title">
          <a className="card__link" href={event.url} target="_blank" rel="noopener noreferrer">
            {event.title}
          </a>
        </h2>
        <dl className="event-card__details">
          <div>
            <dt>日時</dt>
            <dd>{date.range}</dd>
          </div>
          {place !== undefined && (
            <div>
              <dt>場所</dt>
              <dd>{place}</dd>
            </div>
          )}
          {event.organizer !== undefined && (
            <div>
              <dt>主催</dt>
              <dd>{event.organizer}</dd>
            </div>
          )}
          {participants !== undefined && (
            <div>
              <dt>参加</dt>
              <dd>{participants}</dd>
            </div>
          )}
        </dl>
        <div className="card__footer">
          <TagList tags={event.tags} />
          <span className="card__related">{EVENT_SOURCES[event.source].label}</span>
        </div>
      </div>
    </article>
  );
}
