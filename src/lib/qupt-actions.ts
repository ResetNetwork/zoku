import type { QuptType } from '../types';

export interface QuptAction {
  id: string;
  label: string;
  icon: string;  // Lucide icon name
  prompt: string;  // Template with {{qupt}} placeholder
  requiresConfirm?: boolean;
}

export const QUPT_ACTIONS: Record<QuptType, QuptAction[]> = {
  // GitHub actions
  'github:pull_request': [
    {
      id: 'review',
      label: 'Review',
      icon: 'eye',
      prompt: 'Review this pull request and provide feedback:\n\n{{qupt}}'
    },
    {
      id: 'approve',
      label: 'Approve',
      icon: 'check',
      prompt: 'Review and approve this pull request if it looks good:\n\n{{qupt}}',
      requiresConfirm: true
    },
    {
      id: 'request_changes',
      label: 'Request Changes',
      icon: 'x',
      prompt: 'Review this pull request and request specific changes:\n\n{{qupt}}'
    }
  ],
  'github:issue': [
    {
      id: 'respond',
      label: 'Respond',
      icon: 'message-square',
      prompt: 'Draft a response to this issue:\n\n{{qupt}}'
    },
    {
      id: 'close',
      label: 'Close',
      icon: 'x-circle',
      prompt: 'Close this issue with an appropriate comment:\n\n{{qupt}}',
      requiresConfirm: true
    },
    {
      id: 'convert_to_pr',
      label: 'Create PR',
      icon: 'git-pull-request',
      prompt: 'Create a pull request to resolve this issue:\n\n{{qupt}}'
    }
  ],
  'github:issue_comment': [
    {
      id: 'reply',
      label: 'Reply',
      icon: 'reply',
      prompt: 'Draft a reply to this comment:\n\n{{qupt}}'
    }
  ],
  'github:push': [],
  'github:pr_comment': [
    {
      id: 'reply',
      label: 'Reply',
      icon: 'reply',
      prompt: 'Draft a reply to this PR comment:\n\n{{qupt}}'
    }
  ],
  'github:release': [],

  // Zammad actions
  'zammad:ticket': [
    {
      id: 'reply',
      label: 'Reply',
      icon: 'reply',
      prompt: 'Draft a reply to this support ticket:\n\n{{qupt}}'
    },
    {
      id: 'escalate',
      label: 'Escalate',
      icon: 'arrow-up-circle',
      prompt: 'Escalate this ticket and draft a summary for the escalation:\n\n{{qupt}}'
    },
    {
      id: 'close',
      label: 'Close',
      icon: 'check-circle',
      prompt: 'Close this ticket with a resolution summary:\n\n{{qupt}}',
      requiresConfirm: true
    }
  ],
  'zammad:article': [
    {
      id: 'reply',
      label: 'Reply',
      icon: 'reply',
      prompt: 'Draft a reply to this ticket update:\n\n{{qupt}}'
    }
  ],

  // Google Drive actions
  'gdrive:revision': [
    {
      id: 'summarize',
      label: 'Summarize',
      icon: 'file-text',
      prompt: 'Summarize the changes made in this document revision:\n\n{{qupt}}'
    }
  ],
  'gdrive:comment': [
    {
      id: 'reply',
      label: 'Reply',
      icon: 'message-circle',
      prompt: 'Draft a reply to this document comment:\n\n{{qupt}}'
    },
    {
      id: 'resolve',
      label: 'Resolve',
      icon: 'check-circle',
      prompt: 'Address and resolve this comment:\n\n{{qupt}}'
    }
  ],
  'gdrive:file_created': [],
  'gdrive:file_renamed': [],

  // Gmail actions
  'gmail:message': [
    {
      id: 'reply',
      label: 'Reply',
      icon: 'reply',
      prompt: 'Draft a reply to this email:\n\n{{qupt}}'
    },
    {
      id: 'forward',
      label: 'Forward',
      icon: 'forward',
      prompt: 'Forward this email with a summary:\n\n{{qupt}}'
    }
  ],

  // Oubliette (agent session) actions
  'oubliette:session_started': [],
  'oubliette:session_completed': [
    {
      id: 'followup',
      label: 'Follow-up',
      icon: 'arrow-right',
      prompt: 'Continue from where this session left off:\n\n{{qupt}}'
    }
  ],
  'oubliette:session_failed': [
    {
      id: 'retry',
      label: 'Retry',
      icon: 'refresh-cw',
      prompt: 'Retry this failed task:\n\n{{qupt}}'
    },
    {
      id: 'debug',
      label: 'Debug',
      icon: 'bug',
      prompt: 'Analyze why this session failed and suggest fixes:\n\n{{qupt}}'
    }
  ],

  // Manual entries
  'manual:note': []
};

export function getActionsForType(qupt_type: QuptType | null): QuptAction[] {
  if (!qupt_type) return [];
  return QUPT_ACTIONS[qupt_type] || [];
}

export function getActionById(qupt_type: QuptType | null, actionId: string): QuptAction | undefined {
  const actions = getActionsForType(qupt_type);
  return actions.find(a => a.id === actionId);
}
