import type { SourceHandler } from './index';
import type { QuptInput } from '../types';
import {
  ZammadSearchResponseSchema,
  ZammadArticlesArraySchema,
  type ZammadTicket,
  type ZammadArticle
} from './schemas';

export const zammadHandler: SourceHandler = {
  async collect({ source, config, credentials, since, cursor }) {
    const { url, tag, include_articles = true } = config;
    const { token } = credentials;

    if (!tag) {
      throw new Error('Zammad source requires a tag to filter tickets');
    }

    const headers = {
      'Authorization': `Token token=${token}`,
      'Content-Type': 'application/json'
    };

    const qupts: QuptInput[] = [];

    try {
      // Parse cursor for pagination
      const page = cursor ? parseInt(cursor) : 1;
      const perPage = 50;

      // Build search query with tag (and optional time filter for incremental sync)
      let searchQuery = `tags:${tag}`;
      // Only add time filter if we have a cursor (for pagination continuity)
      // Skip time filter on first sync or when cursor resets to get all tagged tickets
      if (since && cursor) {
        const sinceDate = new Date(since * 1000).toISOString();
        searchQuery += ` AND updated_at:>=${sinceDate}`;
      }

      const searchUrl = `${url}/api/v1/tickets/search?query=${encodeURIComponent(searchQuery)}&page=${page}&per_page=${perPage}&sort_by=updated_at&order_by=asc`;
      console.log(`Zammad search URL: ${searchUrl}`);
      console.log(`Zammad search query: ${searchQuery}`);

      // Search for tickets
      const searchResponse = await fetch(searchUrl, { headers });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error(`Zammad API error (${searchResponse.status}): ${errorText}`);
      }

      const searchData = await searchResponse.json();
      const parseResult = ZammadSearchResponseSchema.safeParse(searchData);
      
      if (!parseResult.success) {
        console.error('Zammad API response validation failed:', parseResult.error);
        throw new Error('Invalid Zammad API response format');
      }

      // Handle both array response and assets response formats
      let ticketsArray: ZammadTicket[] = [];
      if (Array.isArray(parseResult.data)) {
        ticketsArray = parseResult.data;
      } else if (parseResult.data.assets?.Ticket) {
        ticketsArray = Object.values(parseResult.data.assets.Ticket);
      }

      console.log(`Zammad search found ${ticketsArray.length} tickets`);

      // Create ticket qupts
      for (const ticket of ticketsArray) {
        try {
          console.log(`Processing ticket #${ticket.number || ticket.id}: ${ticket.title}`);
          const ticketTime = new Date(ticket.updated_at).getTime() / 1000;

          // Create qupt for ticket update
          qupts.push({
            entanglement_id: source.entanglement_id,
            content: formatTicketContent(ticket),
            source: 'zammad',
            external_id: `zammad:ticket:${ticket.id}:${ticket.updated_at}`,
            metadata: {
              type: 'ticket',
              ticket_id: ticket.id,
              ticket_number: ticket.number,
              title: ticket.title,
              note: ticket.note,
              body: ticket.note || ticket.body,
              state: ticket.state_id || ticket.state,
              priority: ticket.priority_id || ticket.priority,
              group: ticket.group_id || ticket.group,
              owner: ticket.owner_id || ticket.owner,
              customer: ticket.customer_id || ticket.customer,
              url: `${url}/#ticket/zoom/${ticket.id}`
            },
            created_at: Math.floor(ticketTime)
          });
          console.log(`Created qupt for ticket #${ticket.number}`);
        } catch (error) {
          console.error(`Error processing ticket:`, error, ticket);
        }
      }

      // Fetch all articles in parallel if configured
      if (include_articles) {
        const articleFetches = ticketsArray.map(async (ticket) => {
          try {
            const articlesResponse = await fetch(
              `${url}/api/v1/ticket_articles/by_ticket/${ticket.id}`,
              { headers }
            );

            if (articlesResponse.ok) {
              const articlesData = await articlesResponse.json();
              const articlesParse = ZammadArticlesArraySchema.safeParse(articlesData);
              if (articlesParse.success) {
                return { ticket, articles: articlesParse.data };
              } else {
                console.error(`Invalid articles format for ticket ${ticket.id}`);
              }
            }
          } catch (articleError) {
            console.error(`Error fetching articles for ticket ${ticket.id}:`, articleError);
          }
          return { ticket, articles: [] };
        });

        // Fetch all articles in parallel
        const ticketsWithArticles = await Promise.all(articleFetches);

        // Process articles and create qupts
        for (const { ticket, articles } of ticketsWithArticles) {
          for (const article of articles) {
            const articleTime = new Date(article.created_at).getTime() / 1000;

            // Skip articles before last sync
            if (since && articleTime <= since) continue;

            qupts.push({
              entanglement_id: source.entanglement_id,
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
                body: article.body,
                article_type: article.type,
                internal: article.internal,
                sender: article.sender,
                url: `${url}/#ticket/zoom/${ticket.id}`
              },
              created_at: Math.floor(articleTime)
            });
          }
        }
      }

      // Determine next cursor
      const hasMore = ticketsArray.length === perPage;
      const nextCursor = hasMore ? String(page + 1) : null;

      console.log(`Zammad handler collected ${qupts.length} qupts from ${ticketsArray.length} tickets`);
      return { qupts, cursor: nextCursor };
    } catch (error) {
      console.error(`Zammad handler error for source ${source.id}:`, error);
      // Return empty results, will retry on next cron
      return { qupts: [], cursor: null };
    }
  }
};

function formatTicketContent(ticket: any): string {
  // Map common state IDs to names (Zammad default states)
  const stateMap: Record<number, string> = {
    1: 'new',
    2: 'open',
    3: 'pending',
    4: 'closed',
    5: 'merged',
    6: 'removed',
    7: 'pending close'
  };
  const state = stateMap[ticket.state_id] || ticket.state || 'open';
  return `#${ticket.number}: ${ticket.title} [${state}]`;
}

function formatArticleContent(article: any, ticket: any): string {
  const sender = article.from || article.sender || 'Unknown';
  const type = article.type || 'note';
  return `#${ticket.number}: ${ticket.title} [${type}]`;
}
