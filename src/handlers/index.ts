// Source handler interface and registry

import type { Source, QuptInput } from '../types';

export interface SourceHandler {
  collect(params: {
    source: Source;
    config: Record<string, any>;
    credentials: Record<string, any>;
    since: number | null;
    cursor: string | null;
  }): Promise<{
    qupts: QuptInput[];
    cursor: string | null;
  }>;
}

import { githubHandler } from './github';
import { zammadHandler } from './zammad';
import { gdocsHandler } from './gdocs';

export const handlers: Record<string, SourceHandler> = {
  github: githubHandler,
  zammad: zammadHandler,
  gdocs: gdocsHandler
  // Will add gmail, gdrive, webhook handlers later
};
