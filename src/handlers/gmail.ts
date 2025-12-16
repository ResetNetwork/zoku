import type { SourceHandler } from './index';
import type { QuptInput } from '../types';
import { refreshGoogleAccessToken } from './google-auth';

export const gmailHandler: SourceHandler = {
  async collect({ source, config, credentials, since, cursor }) {
    const { label } = config;

    if (!label) {
      throw new Error('Gmail source requires a "label" in config');
    }

    const qupts: QuptInput[] = [];

    try {
      console.log(`📧 Fetching Gmail messages with label: ${label}`);

      // Get access token from Google OAuth refresh token
      const accessToken = await refreshGoogleAccessToken(credentials);
      console.log('✅ Got access token');

      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };

      // First, get the label ID from the label name
      const labelsResponse = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/labels',
        { headers }
      );

      if (!labelsResponse.ok) {
        const errorText = await labelsResponse.text();
        throw new Error(`Gmail API error (${labelsResponse.status}): ${errorText}`);
      }

      const labelsData = await labelsResponse.json() as { labels: Array<{ id: string; name: string }> };
      const targetLabel = labelsData.labels.find(
        l => l.name.toLowerCase() === label.toLowerCase()
      );

      if (!targetLabel) {
        throw new Error(`Label "${label}" not found in Gmail account. Available labels: ${labelsData.labels.map(l => l.name).join(', ')}`);
      }

      console.log(`✅ Found label "${label}" with ID: ${targetLabel.id}`);

      // Build query for messages with this label
      let query = `labelIds=${targetLabel.id}&maxResults=100`;
      
      // Add date filter if provided
      if (since) {
        const sinceDate = new Date(since * 1000);
        const afterDate = sinceDate.toISOString().split('T')[0].replace(/-/g, '/');
        query += `&q=after:${afterDate}`;
      }

      // Add pagination cursor if provided
      if (cursor) {
        query += `&pageToken=${cursor}`;
      }

      // Fetch messages
      const messagesResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${query}`,
        { headers }
      );

      console.log(`📡 Messages fetch status: ${messagesResponse.status}`);

      if (!messagesResponse.ok) {
        const errorText = await messagesResponse.text();
        throw new Error(`Gmail API error (${messagesResponse.status}): ${errorText}`);
      }

      const messagesData = await messagesResponse.json() as { 
        messages?: Array<{ id: string; threadId: string }>;
        nextPageToken?: string;
      };

      if (!messagesData.messages || messagesData.messages.length === 0) {
        console.log('📭 No messages found');
        return { qupts: [], cursor: null };
      }

      console.log(`✉️  Found ${messagesData.messages.length} messages`);

      // Fetch full details for each message
      for (const msg of messagesData.messages) {
        try {
          const detailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers }
          );

          if (!detailResponse.ok) {
            console.error(`Failed to fetch message ${msg.id}`);
            continue;
          }

          const message = await detailResponse.json() as {
            id: string;
            threadId: string;
            internalDate: string;
            payload: {
              headers: Array<{ name: string; value: string }>;
              body?: { data?: string };
              parts?: Array<{ mimeType: string; body?: { data?: string } }>;
            };
          };

          // Extract headers
          const headers_map = new Map(
            message.payload.headers.map(h => [h.name.toLowerCase(), h.value])
          );

          const subject = headers_map.get('subject') || '(no subject)';
          const from = headers_map.get('from') || 'unknown';
          const date = headers_map.get('date') || '';

          // Extract body (simplified - gets first text part)
          let bodyPreview = '';
          if (message.payload.body?.data) {
            bodyPreview = Buffer.from(message.payload.body.data, 'base64').toString('utf-8').substring(0, 200);
          } else if (message.payload.parts) {
            const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
            if (textPart?.body?.data) {
              bodyPreview = Buffer.from(textPart.body.data, 'base64').toString('utf-8').substring(0, 200);
            }
          }

          const timestamp = Math.floor(parseInt(message.internalDate) / 1000);

          // Skip if older than 'since' filter
          if (since && timestamp < since) {
            continue;
          }

          qupts.push({
            entanglement_id: source.entanglement_id,
            content: `${from}: ${subject}`,
            source: 'gmail',
            external_id: `gmail:${message.id}`,
            metadata: {
              message_id: message.id,
              thread_id: message.threadId,
              subject,
              from,
              date,
              label,
              body_preview: bodyPreview.trim(),
              url: `https://mail.google.com/mail/u/0/#inbox/${message.id}`
            },
            created_at: timestamp
          });

        } catch (error) {
          console.error(`Error processing message ${msg.id}:`, error);
        }
      }

      console.log(`✅ Collected ${qupts.length} qupts from Gmail`);

      return {
        qupts,
        cursor: messagesData.nextPageToken || null
      };

    } catch (error) {
      console.error('Gmail handler error:', error);
      throw error;
    }
  }
};
