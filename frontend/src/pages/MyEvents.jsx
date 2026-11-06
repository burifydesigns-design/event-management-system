import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import SuccessMessage from "../components/SuccessMessage";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination from "../components/Pagination";
import { getMyEvents } from "../services/registrationService";
import { cancelRegistration } from "../services/registrationService";

export default function MyEvents() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [cancelId, setCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false });
  const [counts, setCounts] = useState({ upcoming: 0, past: 0, cancelled: 0 });

  useEffect(() => {
    const fetchRegistrations = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMyEvents({ tab: activeTab, page, limit });
        setRegistrations(data.data || []);
        if (data.pagination) setPagination(data.pagination);
        if (data.counts) setCounts(data.counts);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load your events. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchRegistrations();
  }, [activeTab, page, limit]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      setCancelling(true);
      await cancelRegistration(cancelId);
      setRegistrations((prev) => prev.filter((r) => r._id !== cancelId));
      setSuccess("Registration cancelled.");
      setCancelId(null);
      try {
        const data = await getMyEvents({ tab: activeTab, page, limit });
        if (data.counts) setCounts(data.counts);
        if (data.pagination) setPagination(data.pagination);
      } catch (e) {}
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel registration.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <Loading text="Loading your events..." />

  return (
    <div className="page page--my-events">
      <div className="container">
        <div style={{ marginBottom: 16 }}>
          <h1>My events</h1>
          <p style={{ color: 'var(--mu)', fontSize: 14 }}>Manage your event registrations.</p>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['upcoming', 'past', 'cancelled'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`chip ${activeTab === tab ? 'chip--selected' : ''}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({counts[tab] || 0})
            </button>
          ))}
        </div>

        {registrations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--mu)' }}>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No {activeTab} events</p>
            <p style={{ marginBottom: 12 }}>
              {activeTab === "upcoming" ? "You haven't registered for any upcoming events yet." : activeTab === "past" ? "You have no past events." : "You have no cancelled registrations."}
            </p>
            <Link to="/events" className="btn btn--primary">Browse events</Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {registrations.map((reg) => (
                <div key={reg._id} style={{ border: '1px solid var(--ln)', borderRadius: 6, background: 'var(--sf)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{reg.event?.title || 'Event'}</h3>
                      <div style={{ color: 'var(--mu)', fontSize: 13, marginTop: 2 }}>
                        {new Date(reg.event?.date || reg.date).toLocaleDateString()} • {reg.event?.city || reg.event?.location || ''}
                      </div>
                    </div>
                    <span className={`pill ${reg.status === 'confirmed' ? 'pill--ok' : 'pill--bad'}`}>{reg.status}</span>
                  </div>
                  <div style={{ color: 'var(--tx)', fontSize: 13 }}>Ticket #{reg.ticketNumber}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <Link to={`/my-ticket/${reg._id}`} className="btn btn--ghost" style={{ height: 36, padding: '0 12px', fontSize: 13 }}>View ticket</Link>
                    <Link to={`/events/${reg.event?._id}`} className="btn btn--ghost" style={{ height: 36, padding: '0 12px', fontSize: 13 }}>View event</Link>
                    {reg.status === "confirmed" && activeTab !== "cancelled" && (
                      <button onClick={() => setCancelId(reg._id)} className="btn btn--ghost" style={{ height: 36, padding: '0 12px', fontSize: 13 }}>Cancel</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={handlePageChange} />
          </>
        )}

        <ConfirmDialog
          visible={!!cancelId}
          message="Are you sure you want to cancel this registration?"
          onConfirm={handleCancel}
          onCancel={() => setCancelId(null)}
        />
      </div>
    </div>
  );
}
