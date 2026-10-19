function canManageEvent(user, event) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'organizer' || !event) return false;

  const userId = user.userId || user._id;
  const organizerId = event.organizer?._id || event.organizer;
  return Boolean(userId && organizerId && String(userId) === String(organizerId));
}

module.exports = { canManageEvent };
