import {type CSSProperties} from 'react';

export const BusyIndicator = (props: {
  color?: string;
  size?: string;
  message?: string;
}) => (
  <span
    className={'__wcx_busy'}
    aria-label={props.message}
  >
    <span
      style={{
        '--size': props.size,
        '--color': props.color,
      } as CSSProperties}
      className={'__wcx_bar'}
    />
  </span>
);
