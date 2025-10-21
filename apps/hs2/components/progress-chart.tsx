'use client';

import { BarSegment, useChart } from '@chakra-ui/charts';

type ProgressChartData = {
  name: string;
  value: number;
  color: string;
};

const ProgressChart = ({ data }: { data: ProgressChartData[] }) => {
  const chart = useChart({
    // sort: { by: 'value', direction: 'desc' },
    data,
  });

  return (
    <BarSegment.Root chart={chart} barSize='3'>
      <BarSegment.Content>
        <BarSegment.Bar gap='0.5' />
      </BarSegment.Content>
      <BarSegment.Legend gap='2' textStyle='xs' showPercent />
    </BarSegment.Root>
  );
};

export default ProgressChart;
