import { type HTMLChakraProps, chakra } from '@chakra-ui/react';

export const RailTunnel = (props: HTMLChakraProps<'svg'>) => {
  return (
    <chakra.svg viewBox='0 0 512 512' {...props}>
      <path
        d='M256 0C114.6 0 0 114.6 0 256v192c0 35.3 28.7 64 64 64h41.4l64.3-64.3c-32.4-3.2-57.7-30.5-57.7-63.7V192c0-35.3 28.7-64 64-64h160c35.3 0 64 28.7 64 64v192c0 33.2-25.3 60.5-57.7 63.7l64.3 64.3H448c35.3 0 64-28.7 64-64V256C512 114.6 397.4 0 256 0zm105.4 512-64-64h-82.7l-64 64h210.7zM184 192c-13.3 0-24 10.7-24 24v80c0 13.3 10.7 24 24 24h144c13.3 0 24-10.7 24-24v-80c0-13.3-10.7-24-24-24H184zm104 192a32 32 0 1 0-64 0 32 32 0 1 0 64 0z'
        fill='currentColor'
      />
    </chakra.svg>
  );
};
