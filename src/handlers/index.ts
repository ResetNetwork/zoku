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
import { gdriveHandler } from './gdrive';
import { gmailHandler } from './gmail';

export const handlers: Record<string, SourceHandler> = {
  github: githubHandler,
  zammad: zammadHandler,
  gdrive: gdriveHandler,
  gmail: gmailHandler
};
