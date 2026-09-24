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

function generateRegistrationConfirmationHtml(data) {
  const { userName, eventTitle, eventDate, eventTime, eventLocation, eventCity, ticketNumber, myEventsUrl, ticketUrl, qrImage } = data;

  const safeUserName = escapeHtml(userName);
  const safeEventTitle = escapeHtml(eventTitle);
  const safeEventDate = escapeHtml(formatDate(eventDate));
  const safeEventTime = escapeHtml(eventTime);
  const safeEventLocation = escapeHtml(eventLocation);
  const safeEventCity = escapeHtml(eventCity);
  const safeTicketNumber = escapeHtml(ticketNumber);
  const safeMyEventsUrl = escapeHtml(myEventsUrl);
  const safeTicketUrl = escapeHtml(ticketUrl);

  const qrSection = qrImage
    ? `<tr>
        <td style="padding: 0 20px 20px; text-align: center;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b;"><strong>Your QR Code</strong></p>
          <img src="${qrImage}" alt="QR Code" style="width: 160px; height: 160px; display: block; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;" />
          <p style="margin: 12px 0 0; font-size: 12px; color: #94a3b8;">Scan this code at the venue for check-in</p>
        </td>
      </tr>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #2563eb; padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Registration Confirmed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #333333;">Hello <strong>${safeUserName}</strong>,</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #333333;">Your registration for <strong>${safeEventTitle}</strong> has been confirmed.</p>
              
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
                          <p style="margin: 4px 0 0; font-size: 16px; color: #1e293b;">${safeEventLocation}, ${safeEventCity}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Ticket Number:</strong></p>
                          <p style="margin: 4px 0 0; font-size: 18px; color: #2563eb; font-weight: 600; font-family: monospace;">${safeTicketNumber}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${qrSection}

              <p style="margin: 0 0 16px; font-size: 16px; color: #333333;"><strong>Registration Status:</strong> Confirmed</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24px;">
                <tr>
                  <td style="padding: 12px 0;">
                    <a href="${safeMyEventsUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">View My Events</a>
                  </td>
                  <td style="padding: 12px 0; text-align: right;">
                    <a href="${safeTicketUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">View Ticket</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">This is an automated message. Please do not reply to this email.</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #94a3b8;">If you did not register for this event, please contact support.</p>
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

function generateRegistrationConfirmationText(data) {
  const { userName, eventTitle, eventDate, eventTime, eventLocation, eventCity, ticketNumber, myEventsUrl, ticketUrl } = data;

  return `
Registration Confirmed

Hello ${userName},

Your registration for ${eventTitle} has been confirmed.

Event: ${eventTitle}
Date: ${formatDate(eventDate)}
Time: ${eventTime}
Location: ${eventLocation}, ${eventCity}
Ticket Number: ${ticketNumber}

Registration Status: Confirmed

View Your Ticket: ${ticketUrl}
View My Events: ${myEventsUrl}

---
This is an automated message. Please do not reply to this email.
If you did not register for this event, please contact support.
  `.trim();
}

module.exports = {
  generateRegistrationConfirmationHtml,
  generateRegistrationConfirmationText,
};