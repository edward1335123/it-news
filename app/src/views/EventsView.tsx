import type { EventsFile } from '@itnews/shared';
import { EventCard } from '../components/EventCard';
import { EmptyView, ErrorView, LoadingView } from '../components/StatusView';
import { sortEvents } from '../lib/filter';
import type { LoadState } from '../lib/useRemoteData';

type Props = {
  events: LoadState<EventsFile>;
  onRetry: () => void;
};

export function EventsView({ events, onRetry }: Props) {
  if (events.status === 'loading') return <LoadingView label="イベントを読み込み中" />;
  if (events.status === 'error') {
    return (
      <ErrorView
        message="イベントを読み込めませんでした"
        detail={events.message}
        onRetry={onRetry}
      />
    );
  }
  const sorted = sortEvents(events.data.events);
  if (sorted.length === 0) return <EmptyView message="予定されているイベントはありません" />;
  return (
    <ul className="list">
      {sorted.map((event) => (
        <li key={event.id}>
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  );
}
