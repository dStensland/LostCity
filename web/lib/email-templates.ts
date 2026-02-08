function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

interface GeneralInviteParams {
  inviterName: string;
  inviteUrl: string;
}

export function generalInviteEmail({ inviterName, inviteUrl }: GeneralInviteParams) {
  const safeName = escapeHtml(inviterName);
  const safeUrl = escapeHtml(inviteUrl);

  const subject = `${inviterName} invited you to Lost City`;

  const text = `${inviterName} invited you to join Lost City - discover the best events happening in your city!

Join here: ${inviteUrl}`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0f; color: #e8e0d4; padding: 32px; border-radius: 12px;">
  <h2 style="color: #ff6b7a; margin: 0 0 16px 0; font-size: 20px;">${safeName} invited you to Lost City</h2>
  <p style="color: #b8b0a4; line-height: 1.6; margin: 0 0 24px 0;">
    Discover the best events, venues, and things to do in your city. Your friend is already on Lost City and wants to connect.
  </p>
  <a href="${safeUrl}" style="display: inline-block; background: #ff6b7a; color: #0a0a0f; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
    Join Lost City
  </a>
  <p style="color: #666; font-size: 12px; margin-top: 32px;">
    Lost City helps you find the best things happening around you.
  </p>
</div>`.trim();

  return { subject, text, html };
}

interface EventInviteParams {
  inviterName: string;
  eventTitle: string;
  eventUrl: string;
  inviteUrl: string;
}

export function eventInviteEmail({ inviterName, eventTitle, eventUrl, inviteUrl }: EventInviteParams) {
  const safeName = escapeHtml(inviterName);
  const safeEvent = escapeHtml(eventTitle);
  const safeEventUrl = escapeHtml(eventUrl);
  const safeInviteUrl = escapeHtml(inviteUrl);

  const subject = `${inviterName} invited you to ${eventTitle}`;

  const text = `${inviterName} invited you to ${eventTitle} on Lost City!

Check out the event: ${eventUrl}

Don't have an account yet? Join here: ${inviteUrl}`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0f; color: #e8e0d4; padding: 32px; border-radius: 12px;">
  <h2 style="color: #ff6b7a; margin: 0 0 8px 0; font-size: 20px;">${safeName} invited you to an event</h2>
  <p style="color: #e8e0d4; font-size: 18px; margin: 0 0 16px 0; font-weight: 600;">${safeEvent}</p>
  <p style="color: #b8b0a4; line-height: 1.6; margin: 0 0 24px 0;">
    Your friend wants you to check out this event on Lost City.
  </p>
  <div style="margin-bottom: 16px;">
    <a href="${safeEventUrl}" style="display: inline-block; background: #ff6b7a; color: #0a0a0f; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
      View Event
    </a>
  </div>
  <a href="${safeInviteUrl}" style="color: #ff6b7a; font-size: 14px;">
    Join Lost City
  </a>
  <p style="color: #666; font-size: 12px; margin-top: 32px;">
    Lost City helps you find the best things happening around you.
  </p>
</div>`.trim();

  return { subject, text, html };
}
