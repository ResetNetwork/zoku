import type { SourceHandler } from './index';
import type { QuptInput } from '../types';

export const zammadHandler: SourceHandler = {
  async collect({ source, config, credentials, since, cursor }) {
    const { url, query, include_articles = true } = config;
    const { token } = credentials;

    const headers = {
      'Authorization': `Token token=${token}`,
      'Content-Type': 'application/json'
    };

    const qupts: QuptInput[] = [];

    try {
      // Parse cursor for pagination
      const page = cursor ? parseInt(cursor) : 1;
      const perPage = 50;

      // Build search query with time filter
      let searchQuery = query || 'state:open OR state:pending';
      if (since) {
        const sinceDate = new Date(since * 1000).toISOString();
        searchQuery += ` updated_at:>=${sinceDate}`;
      }

      // Search for tickets
      const searchResponse = await fetch(
        `${url}/api/v1/tickets/search?query=${encodeURIComponent(searchQuery)}&page=${page}&per_page=${perPage}&sort_by=updated_at&order_by=asc`,
        { headers }
      );

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error(`Zammad API error (${searchResponse.status}): ${errorText}`);
      }

      const searchData = await searchResponse.json() as any;
      const tickets = searchData.assets?.Ticket || {};
      const ticketIds = Object.keys(tickets);

      for (const ticketId of ticketIds) {
        const ticket = tickets[ticketId];
        const ticketTime = new Date(ticket.updated_at).getTime() / 1000;

        // Create qupt for ticket update
        qupts.push({
          volition_id: source.volition_id,
          content: formatTicketContent(ticket),
          source: 'zammad',
          external_id: `zammad:ticket:${ticket.id}:${ticket.updated_at}`,
          metadata: {
            type: 'ticket',
            ticket_id: ticket.id,
            ticket_number: ticket.number,
            title: ticket.title,
            state: ticket.state,
            priority: ticket.priority,
            group: ticket.group,
            owner: ticket.owner,
            customer: ticket.customer,
            url: `${url}/#ticket/zoom/${ticket.id}`
          },
          created_at: Math.floor(ticketTime)
        });

        // Fetch articles (comments/replies) if configured
        if (include_articles) {
          try {
            const articlesResponse = await fetch(
              `${url}/api/v1/ticket_articles/by_ticket/${ticketId}`,
              { headers }
            );

            if (articlesResponse.ok) {
              const articles = await articlesResponse.json() as any[];

              for (const article of articles) {
                const articleTime = new Date(article.created_at).getTime() / 1000;

                // Skip articles before last sync
                if (since && articleTime <= since) continue;

                qupts.push({
                  volition_id: source.volition_id,
                  content: formatArticleContent(article, ticket),
                  source: 'zammad',
                  external_id: `zammad:article:${article.id}`,
                  metadata: {
                    type: 'article',
                    article_id: article.id,
                    ticket_id: ticket.id,
                    ticket_number: ticket.number,
                    ticket_title: ticket.title,
                    from: article.from,
                    to: article.to,
                    subject: article.subject,
                    article_type: article.type,
                    internal: article.internal,
                    sender: article.sender,
                    url: `${url}/#ticket/zoom/${ticket.id}`
                  },
                  created_at: Math.floor(articleTime)
                });
              }
            }
          } catch (articleError) {
            console.error(`Error fetching articles for ticket ${ticketId}:`, articleError);
            // Continue with other tickets
          }
        }
      }

      // Determine next cursor
      const hasMore = ticketIds.length === perPage;
      const nextCursor = hasMore ? String(page + 1) : null;

      console.log(`Zammad handler collected ${qupts.length} qupts from ${ticketIds.length} tickets`);
      return { qupts, cursor: nextCursor };
    } catch (error) {
      console.error(`Zammad handler error for source ${source.id}:`, error);
      // Return empty results, will retry on next cron
      return { qupts: [], cursor: null };
    }
  }
};

function formatTicketContent(ticket: any): string {
  const state = ticket.state || 'unknown';
  return `Ticket #${ticket.number} [${state}]: ${ticket.title}`;
}

function formatArticleContent(article: any, ticket: any): string {
  const sender = article.from || article.sender || 'Unknown';
  const type = article.type || 'note';
  const internal = article.internal ? ' (internal)' : '';
  return `${type}${internal} on #${ticket.number} from ${sender}`;
}
