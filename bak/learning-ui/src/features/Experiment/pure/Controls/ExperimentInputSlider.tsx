import { useCallback, useRef, useEffect, useState } from 'react';
import styles from './ExperimentInputSlider.module.css';

export interface ExperimentInputSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number | [number, number];
  onChange: (value: number | [number, number]) => void;
  indicatorValue?: number;
  label?: string;
  variant?: 'default' | 'temperature';
  disabled?: boolean;
  formatValue?: (v: number) => string;
  indicatorColor?: string;
  thumbLabels?: [string, string];
}

export function ExperimentInputSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  indicatorValue,
  label,
  variant = 'default',
  disabled = false,
  formatValue = (v) => v.toFixed(0),
  indicatorColor,
  thumbLabels,
}: ExperimentInputSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const isRange = Array.isArray(value);
  const values = isRange ? (value as [number, number]) : [value as number];

  const getPercent = (val: number) => Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));

  const getValueFromClientX = useCallback((clientX: number) => {
    if (!trackRef.current) return min;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawValue = min + percent * (max - min);
    
    // Fix floating point precision issues (e.g., 1.2000000000000002 -> 1.2)
    const steppedValue = Math.round(rawValue / step) * step;
    const precision = step.toString().split('.')[1]?.length || 0;
    return Number(steppedValue.toFixed(precision));
  }, [min, max, step]);

  // Allow clicking anywhere on the track to jump to that value
  const handleTrackMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    const newValue = getValueFromClientX(e.clientX);
    
    if (!isRange) {
      onChange(newValue);
      setDragging(0);
    } else {
      const dist0 = Math.abs(newValue - values[0]);
      const dist1 = Math.abs(newValue - values[1]);
      const newValues = [...values] as [number, number];
      
      if (dist0 <= dist1) {
        newValues[0] = Math.max(min, Math.min(newValue, newValues[1] - step));
        setDragging(0);
      } else {
        newValues[1] = Math.min(max, Math.max(newValue, newValues[0] + step));
        setDragging(1);
      }
      onChange(newValues);
    }
  };

  // Stop propagation so clicking the thumb doesn't trigger the track click
  const handleThumbMouseDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (disabled) return;
    setDragging(index);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging === null || disabled) return;
    const newValue = getValueFromClientX(e.clientX);
    
    if (!isRange) {
      onChange(newValue);
    } else {
      const newValues = [...values] as [number, number];
      const minGap = step; 
      if (dragging === 0) {
        newValues[0] = Math.max(min, Math.min(newValue, newValues[1] - minGap));
      } else {
        newValues[1] = Math.min(max, Math.max(newValue, newValues[0] + minGap));
      }
      onChange(newValues);
    }
  }, [dragging, disabled, getValueFromClientX, isRange, values, onChange, min, max, step]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (dragging !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
      {label && <div className={styles.label}>{label}</div>}

      <div className={styles.trackContainer} ref={trackRef} onMouseDown={handleTrackMouseDown}>
        <div className={`${styles.track} ${variant === 'temperature' ? styles.trackTemperature : ''}`} />

        {variant === 'default' && (
          <div 
            className={styles.range}
            style={{
              left: isRange ? `${getPercent(values[0])}%` : '0%',
              width: isRange ? `${getPercent(values[1]) - getPercent(values[0])}%` : `${getPercent(values[0])}%`
            }}
          />
        )}

        {indicatorValue !== undefined && (
          <div className={styles.indicator} style={{ left: `${getPercent(indicatorValue)}%` }}>
            <div className={styles.indicatorLine} style={indicatorColor ? { background: indicatorColor } : undefined} />
            <div className={styles.indicatorValue} style={indicatorColor ? { color: indicatorColor } : undefined}>
              {formatValue(indicatorValue)}
            </div>
          </div>
        )}

        {values.map((val, index) => (
          <div
            key={index}
            className={`${styles.thumb} ${dragging === index ? styles.thumbActive : ''} ${variant === 'temperature' ? styles.thumbTemperature : ''}`}
            style={{ left: `${getPercent(val)}%` }}
            onMouseDown={(e) => handleThumbMouseDown(e, index)}
          >
            <div className={styles.thumbLabel}>
              {thumbLabels && thumbLabels[index] ? `${thumbLabels[index]}: ` : ''}
              {formatValue(val)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
