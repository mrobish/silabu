import type { ReactNode } from 'react';

export interface HelpSection {
  icon: string;
  title: string;
  content: ReactNode;
}

export interface HelpDoc {
  title: string;
  sections: HelpSection[];
}
