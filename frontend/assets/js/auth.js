// Wire these up to your login/signup form submit handlers.

async function handleLogin(email, password) {
  const data = await apiRequest('/auth/login', { method: 'POST', body: { email, password }, auth: false });
  localStorage.setItem('token', data.token);
  localStorage.setItem('role', data.user.role);
  return data;
}

async function handleSignup(name, email, password) {
  const data = await apiRequest('/auth/signup', { method: 'POST', body: { name, email, password }, auth: false });
  localStorage.setItem('token', data.token);
  localStorage.setItem('role', data.user.role);
  return data;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  window.location.href = '/login.html';
}
