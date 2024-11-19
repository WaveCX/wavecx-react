import {type CSSProperties} from 'react';

import styles from './busy-indicator.module.css';

export const BusyIndicator = (props: {
  color?: string;
  size?: string;
  message?: string;
  className?: string;
}) => (
  <span
    className={[styles.root, props.className].join(' ')}
    aria-label={props.message}
  >
    <span
      style={{
        '--size': props.size,
        '--color': props.color,
      } as CSSProperties}
      className={styles.bar}
    />
  </span>
);
