'use client';

/**
 * Date-range filter for the Videos tab — Chakra's DatePicker in range mode,
 * following the docs composition. A button trigger shows the picked range (or a
 * placeholder) via ValueText; the indicator group swaps between the calendar
 * trigger (empty) and a clear button (once a range is set). We filter off the
 * picked ISO strings (valueAsString), so the picker stays uncontrolled and
 * reports the range up via onChange.
 */
import { useMemo } from 'react';
import { Button, DatePicker, Portal, Text, parseDate } from '@chakra-ui/react';
import { LuCalendar } from 'react-icons/lu';

// "dd mmm yyyy" (e.g. 05 Jan 2024). UTC so a yyyy-mm-dd string never drifts a
// day when formatted in the local zone.
const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatBritish = (iso: string) => DATE_FMT.format(new Date(`${iso}T00:00:00Z`));

export default function DateRangeFilter({
  onChange,
  minDate,
}: {
  /** Picked range as ISO date strings: [] none, [from], or [from, to]. */
  onChange: (range: string[]) => void;
  /** Earliest selectable date (ISO yyyy-mm-dd) — the oldest video in the data. */
  minDate?: string | null;
}) {
  // Selectable window: oldest video → today. parseDate is re-exported by Chakra
  // (avoids importing the un-hoisted @internationalized/date); today is built as
  // a local ISO string so it doesn't drift a day via UTC.
  const { min, max } = useMemo(() => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return {
      min: minDate ? parseDate(minDate) : undefined,
      max: parseDate(todayIso),
    };
  }, [minDate]);

  return (
    <DatePicker.Root
      selectionMode='range'
      locale='en-GB'
      size='sm'
      width='full'
      min={min}
      max={max}
      // DateValue.toString() is always ISO yyyy-mm-dd, regardless of locale
      // (valueAsString is localized once a locale is set). Send ISO up so the
      // filter's lexical date compare stays correct.
      onValueChange={e => onChange(e.value.map(v => v.toString().slice(0, 10)))}
      positioning={{ placement: 'bottom', gutter: 4 }}
    >
      <DatePicker.Control>
        <DatePicker.Trigger asChild unstyled>
          <Button
            size='sm'
            variant='outline'
            width='full'
            justifyContent='flex-start'
            fontWeight='normal'
            gap={2}
          >
            {/* Calendar icon always on the left, muted to mirror the search
                input's start icon. */}
            <LuCalendar color='var(--chakra-colors-fg-muted)' />
            {/* "dd mmm yyyy to dd mmm yyyy", or a muted placeholder. */}
            <DatePicker.Context>
              {context =>
                context.value.length === 0 ? (
                  <Text as='span' color='fg.muted'>
                    Filter by date
                  </Text>
                ) : (
                  <Text as='span' lineClamp={1}>
                    {context.value
                      .map(v => formatBritish(v.toString().slice(0, 10)))
                      .join(' to ')}
                  </Text>
                )
              }
            </DatePicker.Context>
          </Button>
        </DatePicker.Trigger>
        {/* Clear (✕) only once a range is set, on the right. */}
        <DatePicker.IndicatorGroup>
          <DatePicker.Context>
            {context =>
              context.value.length > 0 ? <DatePicker.ClearTrigger /> : null
            }
          </DatePicker.Context>
        </DatePicker.IndicatorGroup>
      </DatePicker.Control>

      <Portal>
        <DatePicker.Positioner>
          <DatePicker.Content>
            <DatePicker.View view='day'>
              <DatePicker.Header />
              <DatePicker.DayTable />
            </DatePicker.View>
            <DatePicker.View view='month'>
              <DatePicker.Header />
              <DatePicker.MonthTable />
            </DatePicker.View>
            <DatePicker.View view='year'>
              <DatePicker.Header />
              <DatePicker.YearTable />
            </DatePicker.View>
          </DatePicker.Content>
        </DatePicker.Positioner>
      </Portal>
    </DatePicker.Root>
  );
}
