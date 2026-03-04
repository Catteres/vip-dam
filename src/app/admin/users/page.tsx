'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DamUser } from '@/lib/types'

export default function UsersPage() {
  const [users, setUsers] = useState<DamUser[]>([])
  const [loading, setLoading] = useState(true)
  
  // Add user form
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  
  // Edit modal
  const [editingUser, setEditingUser] = useState<DamUser | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Delete confirmation
  const [deletingUser, setDeletingUser] = useState<DamUser | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('dam_users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setUsers(data)
    }
    setLoading(false)
  }

  const addUser = async () => {
    if (!newEmail.trim()) return
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail.trim())) {
      setAddError('Please enter a valid email address')
      return
    }
    
    setAdding(true)
    setAddError('')
    
    // Check if user already exists
    const { data: existing } = await supabase
      .from('dam_users')
      .select('id')
      .eq('email', newEmail.trim().toLowerCase())
      .single()
    
    if (existing) {
      setAddError('A user with this email already exists')
      setAdding(false)
      return
    }
    
    // Insert new user into dam_users
    const { error } = await supabase
      .from('dam_users')
      .insert({
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        favorites: []
      })
    
    if (error) {
      setAddError(error.message)
      setAdding(false)
      return
    }
    
    setNewEmail('')
    setNewRole('user')
    setAdding(false)
    loadUsers()
  }

  const updateUser = async () => {
    if (!editingUser) return
    
    setSaving(true)
    
    const { error } = await supabase
      .from('dam_users')
      .update({ role: editingUser.role })
      .eq('id', editingUser.id)
    
    if (!error) {
      setEditingUser(null)
      loadUsers()
    }
    
    setSaving(false)
  }

  const deleteUser = async () => {
    if (!deletingUser) return
    
    setDeleting(true)
    
    const { error } = await supabase
      .from('dam_users')
      .delete()
      .eq('id', deletingUser.id)
    
    if (!error) {
      setDeletingUser(null)
      loadUsers()
    }
    
    setDeleting(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-zinc-400 mt-1">Manage user access and roles</p>
      </div>

      {/* Add User Form */}
      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 mb-6">
        <h3 className="font-medium text-white mb-3">Add New User</h3>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="Email address"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value)
                setAddError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && addUser()}
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            
            <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg">
              <button
                onClick={() => setNewRole('user')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  newRole === 'user'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                User
              </button>
              <button
                onClick={() => setNewRole('admin')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  newRole === 'admin'
                    ? 'bg-cyan-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Admin
              </button>
            </div>
          </div>
          
          {addError && (
            <p className="text-sm text-red-400">{addError}</p>
          )}
          
          <button
            onClick={addUser}
            disabled={!newEmail.trim() || adding}
            className="w-full sm:w-auto px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {adding && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            )}
            Add User
          </button>
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          No users yet. Add your first user above.
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <div
              key={user.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 bg-zinc-800 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors"
            >
              {/* User Icon & Email */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  user.role === 'admin' ? 'bg-cyan-600/20 text-cyan-400' : 'bg-zinc-700 text-zinc-400'
                }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium truncate">{user.email}</p>
                  <p className="text-xs text-zinc-500">Added {formatDate(user.created_at)}</p>
                </div>
              </div>
              
              {/* Role Badge & Actions */}
              <div className="flex items-center gap-2 pl-13 sm:pl-0">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  user.role === 'admin'
                    ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/30'
                    : 'bg-zinc-700 text-zinc-300 border border-zinc-600'
                }`}>
                  {user.role === 'admin' ? 'Admin' : 'User'}
                </span>
                
                <button
                  onClick={() => setEditingUser({ ...user })}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                  title="Edit user"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeletingUser(user)}
                  className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                  title="Delete user"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {users.length > 0 && (
        <div className="mt-4 flex gap-4 text-sm text-zinc-500">
          <span>{users.length} total users</span>
          <span>•</span>
          <span>{users.filter(u => u.role === 'admin').length} admins</span>
          <span>•</span>
          <span>{users.filter(u => u.role === 'user').length} users</span>
        </div>
      )}

      {/* === EDIT USER MODAL === */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-zinc-900 w-full sm:max-w-md sm:rounded-lg rounded-t-2xl border border-zinc-700">
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Edit User</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-zinc-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Email (read-only) */}
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Email</label>
                <div className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300">
                  {editingUser.email}
                </div>
              </div>

              {/* Role Toggle */}
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Role</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingUser({ ...editingUser, role: 'user' })}
                    className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                      editingUser.role === 'user'
                        ? 'bg-zinc-700 border-zinc-600 text-white'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      User
                    </div>
                    <p className="text-xs mt-1 text-zinc-500">Can browse and download</p>
                  </button>
                  <button
                    onClick={() => setEditingUser({ ...editingUser, role: 'admin' })}
                    className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                      editingUser.role === 'admin'
                        ? 'bg-cyan-600/20 border-cyan-600 text-cyan-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Admin
                    </div>
                    <p className="text-xs mt-1 text-zinc-500">Full access to everything</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-700 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateUser}
                disabled={saving}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === DELETE CONFIRMATION MODAL === */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-zinc-900 w-full sm:max-w-md sm:rounded-lg rounded-t-2xl border border-zinc-700">
            <div className="p-4 border-b border-zinc-700">
              <h3 className="text-lg font-medium text-white">Delete User</h3>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  deletingUser.role === 'admin' ? 'bg-cyan-600/20 text-cyan-400' : 'bg-zinc-700 text-zinc-400'
                }`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">{deletingUser.email}</p>
                  <p className="text-sm text-zinc-500 capitalize">{deletingUser.role}</p>
                </div>
              </div>
              
              <p className="text-zinc-400">
                Are you sure you want to delete this user? This action cannot be undone.
              </p>
            </div>

            <div className="p-4 border-t border-zinc-700 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteUser}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                )}
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
