(function(){
  const HEADER_HTML = `
    <div class="container nav">
      <a class="brand" href="index.html" aria-label="Inicio">
        <div class="logo" aria-hidden="true"></div>
        <div class="brand-copy">
          <span class="brand-title">RRHH App</span>
          <span class="brand-subtitle">Gestión de personal y turnos</span>
        </div>
      </a>
      <nav class="navlinks" aria-label="Navegación principal">
        <a href="ver-usuarios.html"><span class="nav-icon" aria-hidden="true">👥</span><span>Usuarios</span></a>
        <a href="ver-tiendas.html"><span class="nav-icon" aria-hidden="true">🏬</span><span>Tiendas</span></a>
        <a href="asignar-turnos.html"><span class="nav-icon" aria-hidden="true">🗂️</span><span>Turnos</span></a>
        <a href="HorariosSemana.html"><span class="nav-icon" aria-hidden="true">🗓️</span><span>Semana · Horarios</span></a>
        <a href="calendario-usuario.html"><span class="nav-icon" aria-hidden="true">📆</span><span>Mi calendario</span></a>
        <a href="fichajes.html"><span class="nav-icon" aria-hidden="true">📍</span><span>Fichajes</span></a>
        <a href="crear-turno.html"><span class="nav-icon" aria-hidden="true">➕</span><span>Crear turno</span></a>
      </nav>
      <div class="nav-controls">
        <button class="btn btn-outline nav-toggle" id="btnNav" aria-label="Mostrar u ocultar navegación" aria-expanded="false">☰</button>
        <button class="btn btn-outline" id="btnTheme" title="Cambiar tema"></button>
        <div class="user" id="userBox">
          <span id="userLabel">No autenticado</span>
          <a class="btn btn-outline" href="login.html" id="btnLogin">Entrar</a>
          <button class="btn" id="btnLogout" style="display:none">Salir</button>
        </div>
      </div>
    </div>
  `;

  const FOOTER_HTML = `
    <div class="container foot">
      <div class="foot-left">
        <div class="foot-brand">
          <div class="logo logo-sm" aria-hidden="true"></div>
          <div>
            <strong>RRHH App</strong>
            <span>Gestión interna</span>
          </div>
        </div>
        <div class="foot-meta">© <span id="y"></span> RRHH App</div>
      </div>
      <div class="foot-right">
        <a href="login.html">Iniciar sesión</a>
        <span aria-hidden="true">·</span>
        <a href="#" id="goTop">Volver arriba</a>
      </div>
    </div>
  `;

  function ensureLayout(){
    const body = document.body;
    if (!body) return;

    let header = document.querySelector('header.site-header');
    if (!header){
      header = document.createElement('header');
      body.insertBefore(header, body.firstChild);
    }
    header.classList.add('site-header');
    header.innerHTML = HEADER_HTML.trim();

    let footer = document.querySelector('footer.site-footer');
    if (!footer){
      footer = document.createElement('footer');
      body.appendChild(footer);
    }
    footer.classList.add('site-footer');
    footer.innerHTML = FOOTER_HTML.trim();
  }

  function byId(id){
    return document.getElementById(id);
  }

  function setTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch {}
    const btn = byId('btnTheme');
    if (btn){
      btn.textContent = String.fromCharCode(theme === 'dark' ? 0x2600 : 0x263D);
      btn.title = (theme === 'dark') ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    }
  }

  function initTheme(){
    let stored = null;
    try { stored = localStorage.getItem('theme'); } catch {}
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    setTheme(theme);
    const btn = byId('btnTheme');
    if (btn && !btn.dataset.bound){
      btn.addEventListener('click', () => {
        let current = null;
        try { current = localStorage.getItem('theme'); } catch {}
        if (!current) current = document.documentElement.getAttribute('data-theme') || 'dark';
        setTheme(current === 'dark' ? 'light' : 'dark');
      });
      btn.dataset.bound = '1';
    }
  }

  function renderSession(){
    const userBox = byId('userBox');
    if (!userBox) return;
    const userLabel = byId('userLabel');
    const btnLogin = byId('btnLogin');
    const btnLogout = byId('btnLogout');

    let token = null;
    let userRaw = null;
    try { token = localStorage.getItem('token'); } catch {}
    try { userRaw = localStorage.getItem('user'); } catch {}

    if (token && userRaw){
      try {
        const user = JSON.parse(userRaw);
        if (userLabel) userLabel.innerHTML = `${user?.nombre || user?.email || 'Usuario'} <span class="role">${(user?.rol || '').toString()}</span>`;
      } catch {
        if (userLabel) userLabel.textContent = 'Sesión activa';
      }
      if (btnLogin) btnLogin.style.display = 'none';
      if (btnLogout) btnLogout.style.display = 'inline-flex';
    } else {
      if (userLabel) userLabel.textContent = 'No autenticado';
      if (btnLogin) btnLogin.style.display = 'inline-flex';
      if (btnLogout) btnLogout.style.display = 'none';
    }

    if (btnLogout && !btnLogout.dataset.bound){
      btnLogout.addEventListener('click', () => {
        try { localStorage.removeItem('token'); } catch {}
        try { localStorage.removeItem('user'); } catch {}
        renderSession();
      });
      btnLogout.dataset.bound = '1';
    }
  }

  function wireFooterUtilities(){
    const y = byId('y');
    if (y) y.textContent = new Date().getFullYear();
    const goTop = byId('goTop');
    if (goTop && !goTop.dataset.bound){
      goTop.addEventListener('click', (event) => {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      goTop.dataset.bound = '1';
    }
  }

  function wireNavToggle(){
    const btn = byId('btnNav');
    const nav = document.querySelector('header.site-header .navlinks');
    if (!btn || !nav || btn.dataset.bound) return;

    const close = () => {
      nav.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', (event) => {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(event.target) || btn.contains(event.target)) return;
      close();
    });

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        close();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) {
        close();
      }
    });

    btn.dataset.bound = '1';
  }

  function init(){
    ensureLayout();
    initTheme();
    wireNavToggle();
    renderSession();
    wireFooterUtilities();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
