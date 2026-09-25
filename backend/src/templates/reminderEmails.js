function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

function formatDate(dateString) {
  if (!dateString) return 'TBD';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(timeString) {
  if (!timeString) return 'TBD';
  return escapeHtml(timeString);
}

function generateReminder24hHtml(data) {
  const {
    userName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    eventCity,
    ticketNumber,
    ticketUrl,
    organizerName,
  } = data;

  const safeUserName = escapeHtml(userName);
  const safeEventTitle = escapeHtml(eventTitle);
  const safeEventDate = escapeHtml(formatDate(eventDate));
  const safeEventTime = escapeHtml(formatTime(eventTime));
  const safeEventLocation = escapeHtml(eventLocation);
  const safeEventCity = escapeHtml(eventCity);
  const safeTicketNumber = escapeHtml(ticketNumber);
  const safeTicketUrl = escapeHtml(ticketUrl);
  const safeOrganizerName = escapeHtml(organizerName || 'Event Organizer');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reminder: ${safeEventTitle} starts tomorrow</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #f59e0b; padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Event Starting Tomorrow</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #333333;">Hello <strong>${safeUserName}</strong>,</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #333333;">Just a friendly reminder that <strong>${safeEventTitle}</strong> is happening tomorrow.</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Event:</strong></p>
                          <p style="margin: 4px 0 0; font-size: 16px; color: #1e293b;">${safeEventTitle}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Date:</strong></p>
                          <p style="margin: 4px 0 0; font-size: 16px; color: #1e293b;">${safeEventDate}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Time:</strong></p>
                          <p style="margin: 4px 0 0; font-size: 16px; color: #1e293b;">${safeEventTime}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Location:</strong></p>
                          <p style="margin: 4px 0 0; font-size: 16px; color: #1e293b;">${safeEventLocation}${safeEventCity ? ', ' + safeEventCity : ''}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Ticket Number:</strong></p>
                          <p style="margin: 4px 0 0; font-size: 18px; color: #f59e0b; font-weight: 600; font-family: monospace;">${safeTicketNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Organizer:</strong></p>
                          <p style="margin: 4px 0 0; font-size: 16px; color: #1e293b;">${safeOrganizerName}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 16px; color: #333333;"><strong>Check-in Instructions:</strong> Please arrive at least 15 minutes before the event starts and present your digital ticket at the entrance.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24px;">
                <tr>
                  <td style="padding: 12px 0;">
                    <a href="${safeTicketUrl}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">View Digital Ticket</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">This is an automated reminder. Please do not reply to this email.</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #94a3b8;">If you no longer wish to receive these reminders, you can update your notification preferences in your account settings.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function generateReminder24hText(data) {
  const {
    userName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    eventCity,
    ticketNumber,
    ticketUrl,
    organizerName,
  } = data;

  return `
Reminder: ${eventTitle} starts tomorrow

Hello ${userName},

Just a friendly reminder that ${eventTitle} is happening tomorrow.

Event: ${eventTitle}
Date: ${formatDate(eventDate)}
Time: ${eventTime}
Location: ${eventLocation}${eventCity ? ', ' + eventCity : ''}
Ticket Number: ${ticketNumber}
Organizer: ${organizerName || 'Event Organizer'}

Check-in Instructions: Please arrive at least 15 minutes before the event starts and present your digital ticket at the entrance.

View Digital Ticket: ${ticketUrl}

---
This is an automated reminder. Please do not reply to this email.
If you no longer wish to receive these reminders, you can update your notification preferences in your account settings.
  `.trim();
}

function generateReminder1hHtml(data) {
  const {
    userName,
    eventTitle,
    eventTime,
    eventLocation,
    eventCity,
    ticketNumber,
    ticketUrl,
  } = data;

  const safeUserName = escapeHtml(userName);
  const safeEventTitle = escapeHtml(eventTitle);
  const safeEventTime = escapeHtml(formatTime(eventTime));
  const safeEventLocation = escapeHtml(eventLocation);
  const safeEventCity = escapeHtml(eventCity);
  const safeTicketNumber = escapeHtml(ticketNumber);
  const safeTicketUrl = escapeHtml(ticketUrl);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Starting Soon: ${safeEventTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #ef4444; padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Starting Soon</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #333333;">Hello <strong>${safeUserName}</strong>,</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #333333;"><strong>${safeEventTitle}</strong> is starting in about 1 hour.</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Event:</strong></p>
                          <p style="margin: 4px 0 0; font-size: 16px; color: #1e293b;">${safeEventTitle}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Start Time:</strong></p>
                          <p style="margin: 4px 0 0; font-size: 16px; color: #1e293b;">${safeEventTime}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Location:</strong></p>
                          <p style="margin: 4px 0 0; font-size: 16px; color: #1e293b;">${safeEventLocation}${safeEventCity ? ', ' + safeEventCity : ''}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Ticket Number:</strong></p>
                          <p style="margin: 4px 0 0; font-size: 18px; color: #ef4444; font-weight: 600; font-family: monospace;">${safeTicketNumber}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 16px; color: #333333;"><strong>Check-in Instructions:</strong> Head to the venue now and present your digital ticket at the entrance for quick check-in.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24px;">
                <tr>
                  <td style="padding: 12px 0;">
                    <a href="${safeTicketUrl}" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">View Digital Ticket</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">This is an automated reminder. Please do not reply to this email.</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #94a3b8;">If you no longer wish to receive these reminders, you can update your notification preferences in your account settings.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function generateReminder1hText(data) {
  const {
    userName,
    eventTitle,
    eventTime,
    eventLocation,
    eventCity,
    ticketNumber,
    ticketUrl,
  } = data;

  return `
Starting Soon: ${eventTitle}

Hello ${userName},

${eventTitle} is starting in about 1 hour.

Event: ${eventTitle}
Start Time: ${eventTime}
Location: ${eventLocation}${eventCity ? ', ' + eventCity : ''}
Ticket Number: ${ticketNumber}

Check-in Instructions: Head to the venue now and present your digital ticket at the entrance for quick check-in.

View Digital Ticket: ${ticketUrl}

---
This is an automated reminder. Please do not reply to this email.
If you no longer wish to receive these reminders, you can update your notification preferences in your account settings.
  `.trim();
}

module.exports = {
  generateReminder24hHtml,
  generateReminder24hText,
  generateReminder1hHtml,
  generateReminder1hText,
};
