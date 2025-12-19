import type { SourceHandler } from './index';
import type { QuptInput, QuptType } from '../types';
import { 
  GitHubEventsArraySchema, 
  GitHubCommitDetailSchema, 
  GitHubPRDetailSchema,
  type GitHubEvent,
  type GitHubCommit,
  type GitHubPullRequest
} from './schemas';

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

      const responseData = await response.json();
      const parseResult = GitHubEventsArraySchema.safeParse(responseData);
      
      if (!parseResult.success) {
        console.error('GitHub API response validation failed:', parseResult.error);
        throw new Error('Invalid GitHub API response format');
      }
      
      const ghEvents = parseResult.data;

      // Filter events first
      const filteredEvents = ghEvents.filter(event => {
        const eventTime = new Date(event.created_at).getTime() / 1000;
        if (since && eventTime <= since) return false;
        
        const eventType = mapEventType(event.type);
        if (events.length > 0 && !events.includes(eventType)) return false;
        
        return true;
      });

      // Collect all API calls to parallelize
      const detailFetches = filteredEvents.map(async (event) => {
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'Zoku/1.0',
          'X-GitHub-Api-Version': '2022-11-28'
        };

        let commitMessage: string | undefined = undefined;
        let prDetails: GitHubPullRequest | undefined = undefined;

        try {
          if (event.type === 'PushEvent' && event.payload.head) {
            const commitResponse = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/commits/${event.payload.head}`,
              { headers }
            );
            if (commitResponse.ok) {
              const commitData = await commitResponse.json();
              const commitParse = GitHubCommitDetailSchema.safeParse(commitData);
              if (commitParse.success) {
                commitMessage = commitParse.data.commit?.message;
              }
            }
          } else if (event.type === 'PullRequestEvent' && event.payload.pull_request?.number) {
            const prResponse = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/pulls/${event.payload.pull_request.number}`,
              { headers }
            );
            if (prResponse.ok) {
              const prData = await prResponse.json();
              const prParse = GitHubPRDetailSchema.safeParse(prData);
              if (prParse.success) {
                prDetails = prParse.data;
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch details for event ${event.id}:`, error);
        }

        return { event, commitMessage, prDetails };
      });

      // Fetch all details in parallel
      const eventsWithDetails = await Promise.all(detailFetches);

      // Build qupts from enriched events
      for (const { event, commitMessage, prDetails } of eventsWithDetails) {
        const eventTime = new Date(event.created_at).getTime() / 1000;

        // Extract details from event payload
        const issueBody = event.payload.issue?.body;
        const commentBody = event.payload.comment?.body;
        const prTitle = prDetails?.title || event.payload.pull_request?.title;
        const prBody = prDetails?.body || event.payload.pull_request?.body;
        const prUrl = prDetails?.html_url;

        // Enhance content with fetched details
        let content = formatEventContent(event);
        if (event.type === 'PushEvent' && commitMessage) {
          const messageTitle = commitMessage.split('\n')[0];
          const branch = event.payload.ref?.replace('refs/heads/', '') || 'unknown';
          const sha = event.payload.head?.substring(0, 7) || '';
          content = `${branch} ← ${sha}: ${messageTitle}`;
        } else if (event.type === 'PullRequestEvent' && prTitle) {
          const prNumber = event.payload.pull_request?.number;
          const action = event.payload.action;
          content = `#${prNumber}: ${prTitle} [${action}]`;
        }

        qupts.push({
          entanglement_id: source.entanglement_id,
          content,
          source: 'github',
          qupt_type: mapEventToQuptType(event.type),
          external_id: `github:${event.id}`,
          metadata: {
            event_type: event.type,
            actor: event.actor?.login,
            repo: `${owner}/${repo}`,
            payload: event.payload,
            url: prUrl || getEventUrl(event, owner, repo),
            commit_message: commitMessage,
            issue_body: issueBody,
            comment_body: commentBody,
            pr_title: prTitle,
            pr_body: prBody,
            action: event.payload.action,
            issue_number: event.payload.issue?.number,
            pr_number: event.payload.pull_request?.number
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

function mapEventToQuptType(ghType: string): QuptType {
  const map: Record<string, QuptType> = {
    'PushEvent': 'github:push',
    'PullRequestEvent': 'github:pull_request',
    'IssuesEvent': 'github:issue',
    'IssueCommentEvent': 'github:issue_comment',
    'PullRequestReviewCommentEvent': 'github:pr_comment',
    'ReleaseEvent': 'github:release'
  };
  return map[ghType] || 'github:push';
}

function formatEventContent(event: any): string {
  switch (event.type) {
    case 'PushEvent': {
      const branch = event.payload.ref?.replace('refs/heads/', '') || 'unknown';
      const sha = event.payload.head?.substring(0, 7) || '';
      // Will be updated with commit message title after fetch
      return `${branch} ← ${sha}`;
    }

    case 'PullRequestEvent':
      const prNumber = event.payload.pull_request?.number || 'PR';
      const prTitle = event.payload.pull_request?.title || 'Pull Request';
      return `#${prNumber}: ${prTitle} [${event.payload.action}]`;

    case 'IssuesEvent':
      return `#${event.payload.issue.number}: ${event.payload.issue.title} [${event.payload.action}]`;

    case 'IssueCommentEvent':
      return `#${event.payload.issue.number}: ${event.payload.issue.title} [comment]`;

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
