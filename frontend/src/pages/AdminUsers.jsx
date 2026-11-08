import { useState, useEffect } from 'react'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  getAllUsers,
  updateUserRole,
  deleteUser,
  createStaffUser,
} from '../services/adminService'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'coordinator' })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const data = await getAllUsers()
      setUsers(data.data || data || [])
    } catch (err) {
      setError('Unable to load users.')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      setActionLoading(true)
      await updateUserRole(userId, newRole)
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
      )
      setSuccess('User role updated.')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update role.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setActionLoading(true)
      await deleteUser(deleteId)
      setUsers((prev) => prev.filter((u) => u._id !== deleteId))
      setSuccess('User deleted.')
      setDeleteId(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      setActionLoading(true)
      await createStaffUser(newUser)
      setSuccess('Staff account created.')
      setShowCreateForm(false)
      setNewUser({ name: '', email: '', password: '', role: 'coordinator' })
      fetchUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="page page--admin">
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
          <div>
            <h1>Users</h1>
            <p style={{ color: 'var(--mu)', fontSize: 14 }}>Platform users and staff accounts.</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => setShowCreateForm((s) => !s)}>
            {showCreateForm ? 'Cancel' : 'Create staff account'}
          </button>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

        {showCreateForm && (
          <div className="form-card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, marginBottom: 10 }}>Create staff account</h3>
            <form onSubmit={handleCreate} className="form">
              <div className="form-row">
                <div className="field">
                  <label>Full name</label>
                  <input className="input" type="text" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input className="input" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Password</label>
                  <input className="input" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Role</label>
                  <select className="input" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                    <option value="coordinator">Coordinator</option>
                    <option value="organizer">Organizer</option>
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={actionLoading}>{actionLoading ? 'Creating…' : 'Create account'}</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <Loading text="Loading users..." />
        ) : users.length === 0 ? (
          <p style={{ color: 'var(--mu)', textAlign: 'center', padding: 24 }}>No users found.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user._id, e.target.value)}
                        className="input"
                        disabled={actionLoading}
                        style={{ width: '140px', height: 44, padding: '0 10px', fontSize: 13 }}
                      >
                        <option value="attendee">Attendee</option>
                        <option value="organizer">Organizer</option>
                        <option value="admin">Admin</option>
                        <option value="coordinator">Coordinator</option>
                      </select>
                    </td>
                    <td>
                      <span className={`pill ${user.status === 'active' ? 'pill--ok' : 'pill--bad'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="btn btn--icon" onClick={() => setDeleteId(user._id)} aria-label={`Delete ${user.name}`} title="Delete">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ConfirmDialog
          visible={!!deleteId}
          message="Are you sure you want to delete this user?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      </div>
    </div>
  )
}
