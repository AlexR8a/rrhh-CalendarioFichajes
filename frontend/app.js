// Shared header/session helpers for all pages
(function(){
  function byId(id){ return document.getElementById(id); }
  const y = byId('y'); if (y) y.textContent = new Date().getFullYear();
  const goTop = byId('goTop');
  if (goTop) goTop.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  const userBox = byId('userBox');
  const userLabel = byId('userLabel');
  const btnLogin = byId('btnLogin');
  const btnLogout = byId('btnLogout');
  const btnTheme = byId('btnTheme');

  // Tema claro/oscuro
  function setTheme(t){
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    if (btnTheme) btnTheme.textContent = (t === 'dark') ? '☀️' : '🌙'; // muestra el icono del modo a activar
    if (btnTheme) btnTheme.title = (t === 'dark') ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  }
  (function initTheme(){
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    setTheme(theme);
    if (btnTheme) btnTheme.addEventListener('click', () => setTheme((localStorage.getItem('theme') === 'dark') ? 'light' : 'dark'));
  })();

  function renderSession() {
    if (!userBox) return;
    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');
    if (token && userRaw) {
      try {
        const u = JSON.parse(userRaw);
        userLabel.innerHTML = `${u?.nombre || u?.email || 'Usuario'} <span class="role">${(u?.rol||'').toString()}</span>`;
        if (btnLogin) btnLogin.style.display = 'none';
        if (btnLogout) btnLogout.style.display = 'inline-flex';
      } catch {
        userLabel.textContent = 'Sesión activa';
        if (btnLogin) btnLogin.style.display = 'none';
        if (btnLogout) btnLogout.style.display = 'inline-flex';
      }
    } else {
      if (userLabel) userLabel.textContent = 'No autenticado';
      if (btnLogin) btnLogin.style.display = 'inline-flex';
      if (btnLogout) btnLogout.style.display = 'none';
    }
  }

  if (btnLogout) btnLogout.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    renderSession();
  });

  renderSession();
})();
