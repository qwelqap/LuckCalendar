import type { Lang } from './types';

export interface AnnouncementI18nContent {
  title: string;
  lines: string[];
}

export interface Announcement {
  /**
   * Bump this value whenever you want the announcement to show again.
   * Suggestion: use a date string like "2025-12-23" or a semver like "1.2.0".
   */
  version: string;
  /** ISO date string for display only */
  updatedAt: string;
  content: Record<Lang, AnnouncementI18nContent>;
}

/**
 * Edit this file to update announcement content.
 * IMPORTANT: change `version` whenever the announcement is updated, otherwise existing users won't see it again.
 */
export const ANNOUNCEMENT: Announcement = {
  version: '2025-12-23',
  updatedAt: new Date('2025-12-23T00:00:00.000Z').toISOString(),
  content: {
    zh: {
      title: '公告',
      lines: [
        '手机请点击浏览器自带的“分享”按钮，然后选择“添加到主屏幕”以安装 PWA 应用，获得更佳体验。'
      ]
    },
    en: {
      title: 'Announcement',
      lines: [
        'For a better experience, please click the "Share" button in your browser and then "Add to Home Screen" to install the PWA application.'
      ]
    }
  }
};

export const ANNOUNCEMENT_SEEN_KEY = 'luckcalendar_announcement_seen_version';
