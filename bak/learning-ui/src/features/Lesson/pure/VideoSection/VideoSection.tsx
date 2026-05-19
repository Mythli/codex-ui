import { ReactNode } from 'react';
import styles from "./VideoSection.module.css";

export interface VideoSectionProps {
  videoId: string;
  title?: string;
  caption?: ReactNode;
  startTime?: number; // Start time in seconds
}

export function VideoSection({ videoId, title, caption, startTime }: VideoSectionProps) {
  // Use youtube-nocookie.com for better compatibility with CSP and privacy settings
  let embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
  if (startTime !== undefined && startTime > 0) {
    embedUrl += `?start=${Math.floor(startTime)}`;
  }

  return (
    <div className={styles.section}>
      {title && <h4 className={styles.title}>{title}</h4>}
      <div className={styles.wrapper}>
        <iframe
          className={styles.iframe}
          src={embedUrl}
          title={title || 'YouTube video'}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      {caption && <p className={styles.caption}>{caption}</p>}
    </div>
  );
}
