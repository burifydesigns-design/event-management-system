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
      setSuccess("Registration cancelled successfully.");
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

  const displayList = registrations;

  if (loading) return <Loading text="Loading your events..." />;

  return (
    <div className="page-my-events">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">My Events</h1>
          <p className="page-subtitle">Manage your event registrations</p>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

        <div className="tabs">
          <button
            onClick={() => handleTabChange("upcoming")}
            className={`tab-btn ${activeTab === "upcoming" ? "tab-btn--active" : ""}`}
          >
            Upcoming ({counts.upcoming || 0})
          </button>
          <button
            onClick={() => handleTabChange("past")}
            className={`tab-btn ${activeTab === "past" ? "tab-btn--active" : ""}`}
          >
            Past ({counts.past || 0})
          </button>
          <button
            onClick={() => handleTabChange("cancelled")}
            className={`tab-btn ${activeTab === "cancelled" ? "tab-btn--active" : ""}`}
          >
            Cancelled ({counts.cancelled || 0})
          </button>
        </div>

        {displayList.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-icon">📋</p>
            <p className="empty-state-title">No {activeTab} events</p>
            <p className="empty-state-text">
              {activeTab === "upcoming"
                ? "You haven't registered for any upcoming events yet."
                : activeTab === "past"
                ? "You have no past events."
                : "You have no cancelled registrations."}
            </p>
            <Link to="/events" className="btn btn-primary">
              Browse Events
            </Link>
          </div>
        ) : (
          <>
            <div className="registrations-list">
              {displayList.map((reg) => (
                <div key={reg._id} className="registration-card">
                  <div className="registration-card-content">
                    <div className="registration-info">
                      <h3 className="registration-event-title">
                        {reg.event?.title || "Event"}
                      </h3>
                      <div className="registration-meta">
                        <span>📅 {new Date(reg.event?.date || reg.date).toLocaleDateString()}</span>
                        <span>📍 {reg.event?.city || reg.event?.location || ""}</span>
                        <span>🎫 #{reg.ticketNumber}</span>
                        <span>📊 {reg.status}</span>
                      </div>
                    </div>
                    <div className="registration-actions">
                      <Link
                        to={`/my-ticket/${reg._id}`}
                        className="btn btn-outline btn-sm"
                      >
                        View Ticket
                      </Link>
                      <Link
                        to={`/events/${reg.event?._id}`}
                        className="btn btn-outline btn-sm"
                      >
                        View Event
                      </Link>
                      {reg.status === "confirmed" && activeTab !== "cancelled" && (
                        <button
                          onClick={() => setCancelId(reg._id)}
                          className="btn btn-danger btn-sm"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        visible={!!cancelId}
        message="Are you sure you want to cancel this registration?"
        onConfirm={handleCancel}
        onCancel={() => setCancelId(null)}
      />
    </div>
  );
}
