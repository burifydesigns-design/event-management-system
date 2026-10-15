function generateAttendeesCSV(attendees) {
  const headers = ['Name', 'Email', 'Event', 'Ticket Number', 'Registration Date', 'Registration Status', 'Check-in Status'];
  let csv = headers.join(',') + '\n';

  attendees.forEach((r) => {
    const name = r.user ? r.user.name.replace(/"/g, '""') : '';
    const email = r.user ? r.user.email : '';
    const event = r.event ? (r.event.title || '').replace(/"/g, '""') : '';
    const registrationDate = r.registeredAt ? new Date(r.registeredAt).toISOString() : '';
    const checkInStatus = r.checkedIn ? 'Checked In' : 'Not Checked In';
    const row = [name, email, event, r.ticketNumber, registrationDate, r.status, checkInStatus].map((v) => `"${v}"`);
    csv += row.join(',') + '\n';
  });

  return csv;
}

module.exports = { generateAttendeesCSV };
