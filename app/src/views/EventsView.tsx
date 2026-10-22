import { EVENT_FORMAT_IDS, EVENT_FORMATS, EVENT_TYPE_IDS, EVENT_TYPES } from '@itnews/shared';
import type { EventsFile } from '@itnews/shared';
import { EventCard } from '../components/EventCard';
import { FilterChips } from '../components/FilterChips';
import { EmptyView, ErrorView, LoadingView } from '../components/StatusView';
import { filterEvents } from '../lib/filter';
import type { EventFilter } from '../lib/filter';
import { downloadIcs } from '../lib/ics';
import type { LoadState } from '../lib/useRemoteData';

const TYPE_OPTIONS = EVENT_TYPE_IDS.map((id) => ({ id, label: EVENT_TYPES[id].label }));
const FORMAT_OPTIONS = EVENT_FORMAT_IDS.map((id) => ({ id, label: EVENT_FORMATS[id].label }));

type Props = {
  events: LoadState<EventsFile>;
  onRetry: () => void;
  filter: EventFilter;
  onChangeFilter: (filter: EventFilter) => void;
  now: Date;
};

export function EventsView({ events, onRetry, filter, onChangeFilter, now }: Props) {
  return (
    <>
      <FilterChips
        label="種別"
        options={TYPE_OPTIONS}
        selected={filter.type}
        onSelect={(type) => onChangeFilter({ ...filter, type })}
      />
      <FilterChips
        label="開催形式"
        options={FORMAT_OPTIONS}
        selected={filter.format}
        onSelect={(format) => onChangeFilter({ ...filter, format })}
      />
      <EventList events={events} onRetry={onRetry} filter={filter} now={now} />
    </>
  );
}

function EventList({ events, onRetry, filter, now }: Omit<Props, 'onChangeFilter'>) {
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
  const visible = filterEvents(events.data.events, filter, now);
  if (visible.length === 0) {
    const filtered = filter.type !== null || filter.format !== null;
    return (
      <EmptyView
        message="予定されているイベントはありません"
        hint={filtered ? '種別・開催形式の条件を変えてください' : undefined}
      />
    );
  }
  return (
    <ul className="list">
      {visible.map((event) => (
        <li key={event.id}>
          <EventCard event={event} onAddToCalendar={() => downloadIcs(event)} />
        </li>
      ))}
    </ul>
  );
}
