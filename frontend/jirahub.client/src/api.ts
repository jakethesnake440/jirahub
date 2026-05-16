// Basic API helper for JIRA Hub v2
export async function request(url: string, options: any = {}) {
  const token = localStorage.getItem('token');
  const headers: any = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function login(username: string, password: string) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}