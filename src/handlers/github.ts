import type { SourceHandler } from './index';
import type { QuptInput } from '../types';

export const githubHandler: SourceHandler = {
  async collect({ source, config, credentials, since }) {
    const { owner, repo, events = [] } = config;
    const { token } = credentials;

    const qupts: QuptInput[] = [];

    try {
      // Fetch recent events from GitHub API
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/events?per_page=100`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'Zoku/1.0',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error (${response.status}): ${errorText}`);
      }

      const ghEvents = await response.json() as any[];

      for (const event of ghEvents) {
        const eventTime = new Date(event.created_at).getTime() / 1000;

        // Skip if before last sync
        if (since && eventTime <= since) continue;

        // Skip if not in configured events
        const eventType = mapEventType(event.type);
        if (events.length > 0 && !events.includes(eventType)) continue;

        qupts.push({
          volition_id: source.volition_id,
          content: formatEventContent(event),
          source: 'github',
          external_id: `github:${event.id}`,
          metadata: {
            event_type: event.type,
            actor: event.actor?.login,
            repo: `${owner}/${repo}`,
            payload: event.payload,
            url: getEventUrl(event, owner, repo)
          },
          created_at: Math.floor(eventTime)
        });
      }

      console.log(`GitHub handler collected ${qupts.length} qupts for ${owner}/${repo}`);
      return { qupts, cursor: null };
    } catch (error) {
      console.error(`GitHub handler error for source ${source.id}:`, error);
      // Return empty results, will retry on next cron
      return { qupts: [], cursor: null };
    }
  }
};

function mapEventType(ghType: string): string {
  const map: Record<string, string> = {
    'PushEvent': 'push',
    'PullRequestEvent': 'pull_request',
    'IssuesEvent': 'issues',
    'IssueCommentEvent': 'issue_comment',
    'CreateEvent': 'create',
    'DeleteEvent': 'delete',
    'ForkEvent': 'fork',
    'WatchEvent': 'star',
    'ReleaseEvent': 'release'
  };
  return map[ghType] || ghType.toLowerCase();
}

function formatEventContent(event: any): string {
  switch (event.type) {
    case 'PushEvent': {
      const branch = event.payload.ref?.replace('refs/heads/', '') || 'unknown';
      const sha = event.payload.head?.substring(0, 7) || '';
      return `Pushed to ${branch} (${sha}) by @${event.actor.login}`;
    }

    case 'PullRequestEvent':
      return `PR #${event.payload.pull_request.number} ${event.payload.action} by @${event.actor.login}: ${event.payload.pull_request.title}`;

    case 'IssuesEvent':
      return `Issue #${event.payload.issue.number} ${event.payload.action} by @${event.actor.login}: ${event.payload.issue.title}`;

    case 'IssueCommentEvent':
      return `Comment on #${event.payload.issue.number} by @${event.actor.login}`;

    case 'CreateEvent':
      return `Created ${event.payload.ref_type} ${event.payload.ref || ''} by @${event.actor.login}`;

    case 'DeleteEvent':
      return `Deleted ${event.payload.ref_type} ${event.payload.ref} by @${event.actor.login}`;

    case 'ForkEvent':
      return `Repository forked by @${event.actor.login}`;

    case 'WatchEvent':
      return `Repository starred by @${event.actor.login}`;

    case 'ReleaseEvent':
      return `Release ${event.payload.release.tag_name} ${event.payload.action} by @${event.actor.login}`;

    default:
      return `${event.type} by @${event.actor.login}`;
  }
}

function getEventUrl(event: any, owner: string, repo: string): string | null {
  switch (event.type) {
    case 'PushEvent':
      const sha = event.payload.head;
      return sha ? `https://github.com/${owner}/${repo}/commit/${sha}` : null;

    case 'PullRequestEvent':
      return event.payload.pull_request.html_url;

    case 'IssuesEvent':
      return event.payload.issue.html_url;

    case 'IssueCommentEvent':
      return event.payload.comment.html_url;

    case 'ReleaseEvent':
      return event.payload.release.html_url;

    default:
      return `https://github.com/${owner}/${repo}`;
  }
}
