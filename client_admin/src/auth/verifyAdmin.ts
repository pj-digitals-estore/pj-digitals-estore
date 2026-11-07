import { apiRequest } from '../lib/api';

/** Authorization comes from the existing protect + authorize('admin') server route. */
export async function verifyAdmin(token: string, signal: AbortSignal): Promise<void> {
  if (!token) throw new Error('No active session.');
  const response = await apiRequest('/api/admin/stats', {
    signal, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('success' in result) || result.success !== true || !('data' in result)) throw new Error('Invalid admin verification response.');
  const data = result.data;
  if (!data || typeof data !== 'object') throw new Error('Invalid admin verification response.');
  for (const field of ['totalUsers', 'totalProducts', 'totalOrders'] as const) {
    if (!(field in data) || !Number.isSafeInteger((data as Record<string, unknown>)[field]) || Number((data as Record<string, unknown>)[field]) < 0) throw new Error('Invalid admin verification response.');
  }
  if (!('totalRevenue' in data) || typeof data.totalRevenue !== 'number' || !Number.isFinite(data.totalRevenue)
    || !('recentOrders' in data) || !Array.isArray(data.recentOrders)) throw new Error('Invalid admin verification response.');
  // Do not retain private statistics; the dashboard continues to use its preview dataset.
}
