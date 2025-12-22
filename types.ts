
export type EntryType = 'lucky' | 'unlucky' | 'neutral';

export interface Entry {
  id: number;
  date: string;
  type: EntryType;
  score: number;
  actualValue: number;
  category: string;
  note: string;
}

export type Lang = 'zh' | 'en';

export type Page = 1 | 2 | 3; // 1: Add, 2: Dashboard, 3: History
