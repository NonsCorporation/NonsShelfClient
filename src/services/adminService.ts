import { nonsFetch } from '../lib/api'

export interface AdminUser {
  id: number
  username: string
  email: string
  role: string
  roles: string[]
}

async function jsonOrThrow(res: Response): Promise<unknown> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch { /* keep status */ }
    throw new Error(msg)
  }
  return res.json()
}

export const adminService = {
  async searchUsers(q: string): Promise<AdminUser[]> {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
    const data = (await jsonOrThrow(await nonsFetch(`/api/admin/users${qs}`))) as { users: AdminUser[] }
    return data.users ?? []
  },

  async setRoles(userId: number, roles: string[]): Promise<void> {
    await jsonOrThrow(
      await nonsFetch(`/api/admin/users/${userId}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles }),
      }),
    )
  },

  async grantLibrarian(user: AdminUser): Promise<void> {
    const roles = Array.from(new Set([...user.roles, 'librarian']))
    await adminService.setRoles(user.id, roles)
  },

  async revokeLibrarian(user: AdminUser): Promise<void> {
    const roles = user.roles.filter((r) => r !== 'librarian')
    await adminService.setRoles(user.id, roles.length ? roles : ['user'])
  },
}
