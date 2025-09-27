(function(){
  const HEADER_HTML = `
    <div class="container nav">
      <a class="brand" href="index.html" aria-label="Inicio">
        <div class="logo" aria-hidden="true"></div>
        <div>RRHH App</div>
      </a>
      <nav class="navlinks" aria-label="Navegacion principal">
        <a href="ver-usuarios.html">Usuarios</a>
        <a href="ver-tiendas.html">Tiendas</a>
        <a href="asignar-turnos.html">Turnos</a>
        <a href="calendario-usuario.html">Mi calendario</a>
        <a href="fichajes.html">Fichajes</a>
        <a href="crear-turno.html">Crear turno</a>
        <a href="HorariosSemana.html">Semana &ndash; Horarios</a>
      </nav>
      <button class="btn btn-outline" id="btnTheme" title="Cambiar tema"></button>
      <div class="user" id="userBox">
        <span id="userLabel">No autenticado</span>
        <a class="btn btn-outline" href="login.html" id="btnLogin">Entrar</a>
        <button class="btn" id="btnLogout" style="display:none">Salir</button>
      </div>
    </div>
  `;

  const FOOTER_HTML = `
    <div class="container foot">
      <div>&copy; <span id="y"></span> RRHH App &ndash; Gestion interna</div>
      <div>
        <a href="login.html">Iniciar sesion</a>
        <span aria-hidden="true">&#183;</span>
        <a href="#" id="goTop">Ir arriba</a>
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
    if (btn){
      btn.addEventListener('click', () => {
        let current = null;
        try { current = localStorage.getItem('theme'); } catch {}
        if (!current) current = document.documentElement.getAttribute('data-theme') || 'dark';
        setTheme(current === 'dark' ? 'light' : 'dark');
      });
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
        if (userLabel) userLabel.textContent = 'Sesion activa';
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
    if (goTop){
      goTop.addEventListener('click', (event) => {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  function init(){
    ensureLayout();
    initTheme();
    renderSession();
    wireFooterUtilities();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

