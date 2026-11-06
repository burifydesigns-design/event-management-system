const FORMULA_PREFIXES = ['=', '+', '-', '@'];

// Neutralize potential spreadsheet formula injection in untrusted text fields.
// Values beginning with formula characters (=, +, -, @) - optionally preceded by
// whitespace or control characters - are prefixed with a single quote so
// spreadsheet applications treat them as literal text instead of executing them.
// The leading apostrophe is not rendered by Excel/LibreOffice/Sheets.
function neutralizeFormula(value) {
  if (value == null) return value;
  const s = String(value);
  const trimmed = s.trimStart();
  if (trimmed.length === 0 || !FORMULA_PREFIXES.includes(trimmed[0])) {
    return s;
  }
  return `'${s}`;
}

// RFC 4180-compatible CSV field escaping.
// Wraps a field in double quotes when it contains a comma, double quote,
// line break, or carriage return. Embedded double quotes are doubled.
function escapeCsvField(value) {
  if (value == null) return '';
  let s = neutralizeFormula(value);
  if (/[",\r\n]/.test(s)) {
    s = s.replace(/"/g, '""');
    return `"${s}"`;
  }
  return s;
}

function formatDate(value) {
  if (value == null) return '';
  return new Date(value).toISOString();
}

// Build a UTF-8 CSV document (with BOM for spreadsheet compatibility) from a
// list of registration documents. Only permitted, non-sensitive fields are
// included. Raw MongoDB documents / populated user objects are never emitted.
function generateAttendeesCSV(registrations, options = {}) {
  const headers = [
    'Event',
    'Attendee Name',
    'Attendee Email',
    'Ticket Number',
    'Registration Date',
    'Registration Status',
    'Check-in Status',
    'Check-in Date',
  ];

  const lines = [headers.map(escapeCsvField).join(',')];

  for (const r of registrations) {
    const user = r.user || {};
    const event = r.event || {};
    const checkedIn = r.checkedIn === true;
    const row = [
      event.title || options.eventTitle || '',
      user.name || '',
      user.email || '',
      r.ticketNumber || '',
      formatDate(r.registeredAt),
      r.status || '',
      checkedIn ? 'Checked In' : 'Not Checked In',
      formatDate(r.checkedInAt),
    ].map(escapeCsvField);

    lines.push(row.join(','));
  }

  // UTF-8 BOM helps Excel and other spreadsheet apps detect UTF-8 encoding.
  return `\uFEFF${lines.join('\n')}\n`;
}

module.exports = {
  generateAttendeesCSV,
  escapeCsvField,
  neutralizeFormula,
};
