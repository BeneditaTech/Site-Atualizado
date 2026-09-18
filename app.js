/* =============================================
   BENEDITA TECH — app.js
   =============================================
   Para conectar: preencha FIREBASE_CONFIG abaixo
   com as credenciais do seu projeto Firebase.
   Ative: Firestore + Authentication (Google + Email)
   ============================================= */

   const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAMDzDLNo3_RZWnue_mDMy9rtc8bcb9OxM",
    authDomain: "plataformatech.firebaseapp.com",
    projectId: "plataformatech",
    storageBucket: "plataformatech.firebasestorage.app",
    messagingSenderId: "256905261473",
    appId: "1:256905261473:web:6eb3d374d721c476899be0"
};

// ── Estado global ──────────────────────────────
let db            = null;
let auth          = null;
let firebaseReady = false;
let usuarioAtual  = null;
let todosArtigos  = [];
let curtidas       = new Set(); // IDs de artigos que o usuário curtiu
let artigoComentandoId = null;

const MATERIAS = [
    'Matemática','Português','Ciências','História',
    'Geografia','Física','Química','Biologia',
    'Inglês','Filosofia','Sociologia'
];

const CORES_AVATAR = ['#5A1ED6','#b8834e','#2a7a4b','#e74c3c','#2980b9','#8e44ad'];

// ── Boot ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    inicializarFirebase();
    configurarEventos();
});

// ── Firebase ──────────────────────────────────
function inicializarFirebase() {
    try {
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        db   = firebase.firestore();
        auth = firebase.auth();
        firebaseReady = true;
        auth.onAuthStateChanged(user => {
            usuarioAtual = user;
            atualizarUI_Auth();
            if (user) carregarCurtidasUsuario();
        });
    } catch(e) {
        console.warn('Firebase offline — modo exemplo.', e);
        firebaseReady = false;
        atualizarUI_Auth();
    }
}

// ── Auth UI ───────────────────────────────────
function atualizarUI_Auth() {
    const logado = !!usuarioAtual;

    document.getElementById('secaoPerfil')?.classList.toggle('hidden', !logado);
    document.getElementById('secaoAgenda')?.classList.toggle('hidden', !logado);
    document.getElementById('secaoGuestAviso')?.classList.toggle('hidden', logado);
    const publishBtn = document.getElementById('publishBtn');
    const btnLogin   = document.getElementById('btnHeaderLogin');
    const btnLogout  = document.getElementById('btnHeaderLogout');
    if (publishBtn) publishBtn.style.display = logado ? 'inline-flex' : 'none';
    if (btnLogin)   btnLogin.style.display   = logado ? 'none'        : 'inline-flex';
    if (btnLogout)  btnLogout.style.display  = logado ? 'inline-flex' : 'none';

    if (logado) {
        const nome  = usuarioAtual.displayName || usuarioAtual.email?.split('@')[0] || 'Usuário';
        const email = usuarioAtual.email || '';
        const foto  = usuarioAtual.photoURL;
        document.getElementById('perfilNome').textContent  = nome;
        document.getElementById('perfilEmail').textContent = email;
        const avatarEl = document.getElementById('avatarEl');
        if (avatarEl) {
            avatarEl.innerHTML = foto
                ? `<img src="${foto}" alt="foto" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
                : nome[0].toUpperCase();
        }
        const inputAutor = document.getElementById('inputAutor');
        if (inputAutor) inputAutor.value = nome;
        carregarAgenda();
        carregarSelosPerfil();
    }
}

// ── Curtidas do usuário ───────────────────────
async function carregarCurtidasUsuario() {
    if (!firebaseReady || !usuarioAtual) return;
    try {
        const snap = await db.collection('curtidas')
            .where('uid', '==', usuarioAtual.uid).get();
        curtidas = new Set(snap.docs.map(d => d.data().artigoId));
        // re-renderiza para refletir estado de curtida
        renderizarArtigos();
    } catch(e) { console.warn('Curtidas:', e); }
}

// ── Eventos globais ───────────────────────────
function configurarEventos() {
    // Landing
    document.getElementById('enterPlatformBtn')?.addEventListener('click', () => {
        document.getElementById('landingPage').style.display = 'none';
        document.getElementById('platformPage').classList.add('visible');
        document.body.style.backgroundImage = 'none';
        carregarArtigos();
    });

    // Auth
    document.getElementById('btnHeaderLogin')?.addEventListener('click', abrirModalLogin);
    document.getElementById('btnHeaderLogout')?.addEventListener('click', logout);
    document.getElementById('btnLoginGoogle')?.addEventListener('click', loginComGoogle);
    document.getElementById('formLogin')?.addEventListener('submit', loginComEmail);
    document.getElementById('modalLoginClose')?.addEventListener('click', fecharModalLogin);
    document.getElementById('modalLoginOverlay')?.addEventListener('click', e => {
        if (e.target.id === 'modalLoginOverlay') fecharModalLogin();
    });
    document.getElementById('toggleModoLogin')?.addEventListener('click', () => {
        const check = document.getElementById('loginModoCadastro');
        check.checked = !check.checked;
        document.getElementById('loginBtnTexto').textContent     = check.checked ? 'Criar conta' : 'Entrar';
        document.getElementById('loginTituloTexto').textContent  = check.checked ? '✨ Criar conta' : '👋 Entrar na conta';
        document.getElementById('toggleModoLogin').textContent   = check.checked ? 'Já tenho conta' : 'Criar conta';
        document.getElementById('loginErro')?.classList.add('hidden');
    });

    // Busca
    document.getElementById('searchInput')?.addEventListener('input', () => renderizarArtigos());

    // Publicar
    document.getElementById('publishBtn')?.addEventListener('click', () => {
        if (!usuarioAtual && firebaseReady) { abrirModalLogin(); return; }
        abrirModalPublicar();
    });
    document.getElementById('modalClose')?.addEventListener('click', fecharModalPublicar);
    document.getElementById('modalOverlay')?.addEventListener('click', e => {
        if (e.target.id === 'modalOverlay') fecharModalPublicar();
    });
    document.getElementById('formPublicar')?.addEventListener('submit', publicarArtigo);
    document.getElementById('btnCancelar')?.addEventListener('click', fecharModalPublicar);

    // Modal comentário
    document.getElementById('modalComentarioClose')?.addEventListener('click', fecharModalComentario);
    document.getElementById('modalComentarioOverlay')?.addEventListener('click', e => {
        if (e.target.id === 'modalComentarioOverlay') fecharModalComentario();
    });

    // Selos
    document.getElementById('btnEditarSelos')?.addEventListener('click', abrirModalSelos);
    document.getElementById('modalSelosClose')?.addEventListener('click', fecharModalSelos);
    document.getElementById('btnCancelarSelos')?.addEventListener('click', fecharModalSelos);
    document.getElementById('btnSalvarSelos')?.addEventListener('click', salvarSelos);
    document.getElementById('modalSelosOverlay')?.addEventListener('click', e => {
        if (e.target.id === 'modalSelosOverlay') fecharModalSelos();
    });

    // Agenda
    document.getElementById('saveNotesBtn')?.addEventListener('click', () => {
        salvarAgenda(document.getElementById('notesTextarea')?.value || '');
    });

    // Config
    document.getElementById('configMockBtn')?.addEventListener('click', () => {
        mostrarToast('⚙️ Configurações em desenvolvimento', '');
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            fecharModalPublicar();
            fecharModalLogin();
            fecharModalComentario();
            fecharModalSelos();
        }
    });
}

// ── Auth ──────────────────────────────────────
function abrirModalLogin() { document.getElementById('modalLoginOverlay')?.classList.add('open'); }
function fecharModalLogin() {
    document.getElementById('modalLoginOverlay')?.classList.remove('open');
    document.getElementById('formLogin')?.reset();
    document.getElementById('loginErro')?.classList.add('hidden');
}
async function loginComGoogle() {
    if (!firebaseReady) { mostrarToast('Firebase não configurado ainda.','erro'); return; }
    try {
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
        fecharModalLogin();
        mostrarToast('✅ Login feito!','sucesso');
    } catch(e) { mostrarErroLogin(e.message); }
}
async function loginComEmail(e) {
    e.preventDefault();
    if (!firebaseReady) { mostrarToast('Firebase não configurado ainda.','erro'); return; }
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    const novo  = document.getElementById('loginModoCadastro')?.checked;
    try {
        if (novo) await auth.createUserWithEmailAndPassword(email, senha);
        else      await auth.signInWithEmailAndPassword(email, senha);
        fecharModalLogin();
        mostrarToast(novo ? '✅ Conta criada!' : '✅ Bem-vinda de volta!','sucesso');
    } catch(e) {
        const msgs = {
            'auth/user-not-found':'E-mail não cadastrado.',
            'auth/wrong-password':'Senha incorreta.',
            'auth/email-already-in-use':'E-mail já cadastrado.',
            'auth/weak-password':'Senha fraca (mínimo 6 caracteres).',
            'auth/invalid-email':'E-mail inválido.',
        };
        mostrarErroLogin(msgs[e.code] || e.message);
    }
}
function mostrarErroLogin(msg) {
    const el = document.getElementById('loginErro');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}
async function logout() {
    if (auth) await auth.signOut();
    curtidas.clear();
    mostrarToast('Até logo! 👋','');
    renderizarArtigos();
}
// exposta globalmente para o HTML inline
window.abrirModalLogin = abrirModalLogin;
window.toggleTagPicker = toggleTagPicker;

// ── Feed ──────────────────────────────────────
async function carregarArtigos() {
    const container = document.getElementById('articlesContainer');
    container.innerHTML = `<div class="feed-loading"><div class="spinner"></div><p>Carregando artigos…</p></div>`;
    if (!firebaseReady) { todosArtigos = dadosExemplo(); atualizarContadores(); renderizarArtigos(); return; }
    try {
        const snap = await db.collection('artigos').orderBy('createdAt','desc').limit(50).get();
        todosArtigos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!todosArtigos.length) todosArtigos = dadosExemplo();
        atualizarContadores();
        renderizarArtigos();
    } catch(err) {
        console.error(err);
        todosArtigos = dadosExemplo();
        renderizarArtigos();
    }
}

function renderizarArtigos() {
    const container = document.getElementById('articlesContainer');
    const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    let lista = [...todosArtigos];
    if (q) lista = lista.filter(a =>
        (a.titulo    ||'').toLowerCase().includes(q) ||
        (a.descricao ||'').toLowerCase().includes(q) ||
        (a.autor     ||'').toLowerCase().includes(q) ||
        (a.materia   ||'').toLowerCase().includes(q) ||
        (a.tags||[]).some(t => t.toLowerCase().includes(q))
    );
    if (!lista.length) {
        container.innerHTML = `<div class="feed-loading"><p style="font-size:2rem">🔍</p><p>Nenhum artigo encontrado.</p></div>`;
        return;
    }
    container.innerHTML = lista.map((art,i) => criarCardHTML(art,i)).join('');
    anexarEventosCards();
}

// ── Card HTML ─────────────────────────────────
function criarCardHTML(art, idx) {
    const ini   = (art.autor||'?')[0].toUpperCase();
    const cor   = CORES_AVATAR[ini.charCodeAt(0) % CORES_AVATAR.length];
    const data  = formatarData(art.createdAt);
    const tags  = (art.tags||[]).map(t=>`<li><button class="tag">${escHtml(t)}</button></li>`).join('');
    const ncoms = art.totalComentarios || 0;
    const curtido = curtidas.has(art.id);
    const cls   = art.destaque ? 'artigo-destaque' : '';

    return `
    <article class="artigo ${cls}" data-id="${art.id}" style="animation-delay:${idx*0.05}s">
        <div class="artigo-header">
            <div class="artigo-autor">
                <div class="mini-avatar" style="background:${cor}">${ini}</div>
                <div>
                    <span class="autor-nome">${escHtml(art.autor||'Anônimo')}</span>
                    <span class="artigo-data">${escHtml(art.materia||'')} · ${data}</span>
                </div>
            </div>
            <span class="artigo-materia">${escHtml(art.materia||'')}</span>
        </div>
        <h2 class="artigo-titulo-clicavel">${escHtml(art.titulo||'')}</h2>
        <p class="artigo-descricao">${escHtml(art.descricao||'')}</p>
        ${art.conteudo ? `<div class="artigo-conteudo hidden">${escHtml(art.conteudo)}</div>` : ''}
        ${tags ? `<ul class="tags">${tags}</ul>` : ''}
        <div class="artigo-footer">
            <div class="artigo-meta">
                <button class="btn-like ${curtido?'curtido':''}" data-id="${art.id}" data-likes="${art.likes||0}">
                    ${curtido ? '❤️' : '🤍'} <span class="like-num">${art.likes||0}</span>
                </button>
                <button class="btn-comentar-modal" data-id="${art.id}" data-titulo="${escHtml(art.titulo||'')}">
                    💬 ${ncoms} comentário${ncoms!==1?'s':''}
                </button>
            </div>
            ${art.conteudo ? `<button class="btn btn-sm btn-ler-artigo">Ler artigo ↓</button>` : ''}
        </div>
    </article>`;
}

function anexarEventosCards() {
    const container = document.getElementById('articlesContainer');

    // Expandir artigo
    container.querySelectorAll('.btn-ler-artigo').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const card     = btn.closest('.artigo');
            const conteudo = card?.querySelector('.artigo-conteudo');
            if (!conteudo) return;
            const aberto = !conteudo.classList.contains('hidden');
            conteudo.classList.toggle('hidden', aberto);
            btn.textContent = aberto ? 'Ler artigo ↓' : 'Fechar ↑';
            card.classList.toggle('artigo-expandido', !aberto);
        });
    });

    // Like
    container.querySelectorAll('.btn-like').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); toggleLike(btn); });
    });

    // Comentar (abre modal)
    container.querySelectorAll('.btn-comentar-modal').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            abrirModalComentario(btn.dataset.id, btn.dataset.titulo);
        });
    });

    // Tags
    container.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', e => {
            e.preventDefault();
            const si = document.getElementById('searchInput');
            if (si) { si.value = tag.innerText; si.dispatchEvent(new Event('input')); }
        });
    });
}

// ── Like toggle ───────────────────────────────
async function toggleLike(btn) {
    if (!usuarioAtual) { abrirModalLogin(); mostrarToast('Entre para curtir 💜',''); return; }

    const artigoId = btn.dataset.id;
    const numEl    = btn.querySelector('.like-num');
    const jaCurtiu = curtidas.has(artigoId);
    const delta    = jaCurtiu ? -1 : 1;
    const novoN    = Math.max(0, (parseInt(numEl.textContent)||0) + delta);

    // Optimistic update
    numEl.textContent = novoN;
    btn.querySelector('span:first-child') || void 0; // silence
    btn.innerHTML = `${jaCurtiu?'🤍':'❤️'} <span class="like-num">${novoN}</span>`;
    btn.classList.toggle('curtido', !jaCurtiu);
    if (!jaCurtiu) curtidas.add(artigoId); else curtidas.delete(artigoId);

    const art = todosArtigos.find(a => a.id === artigoId);
    if (art) art.likes = novoN;

    if (firebaseReady && !artigoId.startsWith('ex')) {
        try {
            const curtidasRef = db.collection('curtidas');
            if (jaCurtiu) {
                // Remove curtida
                const snap = await curtidasRef
                    .where('uid','==',usuarioAtual.uid)
                    .where('artigoId','==',artigoId).get();
                snap.forEach(d => d.ref.delete());
            } else {
                await curtidasRef.add({ uid: usuarioAtual.uid, artigoId, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            }
            await db.collection('artigos').doc(artigoId).update({
                likes: firebase.firestore.FieldValue.increment(delta)
            });
        } catch(err) { console.warn('Like sync:', err); }
    }
}

// ── Modal Comentário ──────────────────────────
async function abrirModalComentario(artigoId, titulo) {
    artigoComentandoId = artigoId;
    document.getElementById('modalComentarioTituloArtigo').textContent = titulo;
    document.getElementById('modalComentarioOverlay').classList.add('open');

    const lista = document.getElementById('modalComentariosLista');
    lista.innerHTML = `<div class="feed-loading" style="padding:16px 0"><div class="spinner" style="width:24px;height:24px;border-width:2px"></div></div>`;

    // Form de envio
    const formDiv = document.getElementById('modalComentarioForm');
    if (usuarioAtual) {
        const ini = (usuarioAtual.displayName||usuarioAtual.email||'?')[0].toUpperCase();
        const cor = CORES_AVATAR[ini.charCodeAt(0) % CORES_AVATAR.length];
        formDiv.innerHTML = `
        <form id="formModalComentario" style="margin-top:12px">
            <div class="comentario-input-wrap">
                <div class="mini-avatar" style="background:${usuarioAtual.photoURL?'transparent':cor}">
                    ${usuarioAtual.photoURL
                        ? `<img src="${usuarioAtual.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
                        : ini}
                </div>
                <input type="text" class="input-base comentario-input" id="inputComentarioModal"
                    placeholder="Escreva um comentário…" maxlength="500" required autocomplete="off">
                <button type="submit" class="btn btn-destaque btn-sm">Enviar</button>
            </div>
        </form>`;
        document.getElementById('formModalComentario')?.addEventListener('submit', enviarComentarioModal);
        setTimeout(() => document.getElementById('inputComentarioModal')?.focus(), 100);
    } else {
        formDiv.innerHTML = `<p class="aviso-login-comentario" style="margin-top:12px">
            <button class="link-btn" onclick="abrirModalLogin()">Entre na sua conta</button> para comentar.
        </p>`;
    }

    await carregarComentariosModal(artigoId);
}

function fecharModalComentario() {
    document.getElementById('modalComentarioOverlay')?.classList.remove('open');
    artigoComentandoId = null;
}

async function carregarComentariosModal(artigoId) {
    const lista = document.getElementById('modalComentariosLista');
    if (!firebaseReady || artigoId.startsWith('ex')) {
        lista.innerHTML = renderizarListaComentarios([
            { id:'c1', autor:'Mariana Lima', texto:'Adorei esse resumo! 💜', createdAt: new Date() },
            { id:'c2', autor:'Pedro Alves',  texto:'Me ajudou muito na prova!', createdAt: new Date() },
        ]);
        return;
    }
    try {
        const snap = await db.collection('artigos').doc(artigoId)
            .collection('comentarios').orderBy('createdAt','asc').limit(50).get();
        const coments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        lista.innerHTML = coments.length
            ? renderizarListaComentarios(coments)
            : '<p class="sem-comentarios">Seja a primeira a comentar! 🌟</p>';
    } catch(err) {
        lista.innerHTML = '<p class="sem-comentarios">Erro ao carregar comentários.</p>';
    }
}

function renderizarListaComentarios(coments) {
    return coments.map(c => {
        const ini = (c.autor||'?')[0].toUpperCase();
        const cor = CORES_AVATAR[ini.charCodeAt(0) % CORES_AVATAR.length];
        return `
        <div class="comentario-item">
            <div class="mini-avatar" style="background:${c.fotoURL?'transparent':cor};flex-shrink:0;width:32px;height:32px;font-size:0.78rem">
                ${c.fotoURL
                    ? `<img src="${c.fotoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
                    : ini}
            </div>
            <div class="comentario-corpo">
                <div class="comentario-meta">
                    <strong>${escHtml(c.autor||'Anônimo')}</strong>
                    <span>${formatarData(c.createdAt)}</span>
                </div>
                <p>${escHtml(c.texto||'')}</p>
            </div>
        </div>`;
    }).join('');
}

async function enviarComentarioModal(e) {
    e.preventDefault();
    const input = document.getElementById('inputComentarioModal');
    const texto = input?.value.trim();
    if (!texto) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = '…';

    const novoComent = {
        autor:     usuarioAtual?.displayName || usuarioAtual?.email?.split('@')[0] || 'Anônimo',
        fotoURL:   usuarioAtual?.photoURL || null,
        uid:       usuarioAtual?.uid || null,
        texto,
        createdAt: new Date(),
    };

    if (firebaseReady && artigoComentandoId && !artigoComentandoId.startsWith('ex')) {
        try {
            await db.collection('artigos').doc(artigoComentandoId)
                .collection('comentarios').add({
                    ...novoComent,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            await db.collection('artigos').doc(artigoComentandoId).update({
                totalComentarios: firebase.firestore.FieldValue.increment(1)
            });
        } catch(err) { mostrarToast('Erro ao enviar.','erro'); btn.disabled=false; btn.textContent='Enviar'; return; }
    }

    // Adiciona na lista do modal
    const lista = document.getElementById('modalComentariosLista');
    const semComents = lista.querySelector('.sem-comentarios');
    if (semComents) semComents.remove();
    lista.insertAdjacentHTML('beforeend', renderizarListaComentarios([novoComent]));
    lista.lastElementChild?.scrollIntoView({ behavior:'smooth', block:'nearest' });

    // Atualiza contador no card
    const art = todosArtigos.find(a => a.id === artigoComentandoId);
    if (art) {
        art.totalComentarios = (art.totalComentarios||0)+1;
        const btnToggle = document.querySelector(`.btn-comentar-modal[data-id="${artigoComentandoId}"]`);
        if (btnToggle) {
            const n = art.totalComentarios;
            btnToggle.textContent = `💬 ${n} comentário${n!==1?'s':''}`;
        }
    }

    input.value = '';
    btn.disabled = false; btn.textContent = 'Enviar';
    mostrarToast('💬 Comentário publicado!','sucesso');
}

// ── Publicar artigo ───────────────────────────
// Lista de tags disponíveis
const TAGS_DISPONIVEIS = [
    'ENEM','Vestibular','Revisão','Resumo','Exercícios','Macetes',
    'Fórmulas','Conceitos','Prova','Dicas','Exemplos','Passo a passo',
    'Biologia','Química','Física','Matemática','Português','História',
    'Geografia','Inglês','Filosofia','Sociologia','Ciências',
    'Redação','Gramática','Literatura','Interpretação',
    'Cálculo','Álgebra','Geometria','Trigonometria','Estatística',
    'Orgânica','Inorgânica','Físico-Química',
    'Genética','Ecologia','Evolução','Citologia','Botânica',
    'Contemporânea','Antiga','Medieval','Brasil','Mundo',
    'Cartografia','Geopolítica','Climatologia','Urbanização',
];

let tagsSelecionadas = new Set();

function inicializarTagsPicker() {
    const picker = document.getElementById('tagsPicker');
    if (!picker) return;
    tagsSelecionadas = new Set();
    picker.innerHTML = TAGS_DISPONIVEIS.map(tag => `
        <button type="button" class="tag-opcao" data-tag="${tag}">${tag}</button>
    `).join('');
    picker.querySelectorAll('.tag-opcao').forEach(btn => {
        btn.addEventListener('click', () => toggleTagPicker(btn.dataset.tag));
    });
    atualizarTagsSelecionadas();
}

function toggleTagPicker(tag) {
    if (tagsSelecionadas.has(tag)) {
        tagsSelecionadas.delete(tag);
    } else {
        tagsSelecionadas.add(tag);
    }
    // Atualiza visual do botão no picker
    const btn = document.querySelector(`#tagsPicker .tag-opcao[data-tag="${tag}"]`);
    if (btn) btn.classList.toggle('selecionada', tagsSelecionadas.has(tag));
    atualizarTagsSelecionadas();
}

function atualizarTagsSelecionadas() {
    const container = document.getElementById('tagsSelecionadas');
    const hidden    = document.getElementById('inputTags');
    if (!container) return;
    const arr = Array.from(tagsSelecionadas);
    if (hidden) hidden.value = arr.join(',');
    if (!arr.length) {
        container.innerHTML = '<span class="tags-placeholder">Nenhuma tag selecionada</span>';
        return;
    }
    container.innerHTML = arr.map(tag => `
        <span class="tag-selecionada-pill">
            ${tag}
            <button type="button" onclick="toggleTagPicker('${tag}')" title="Remover">×</button>
        </span>
    `).join('');
}

function abrirModalPublicar() {
    document.getElementById('modalOverlay')?.classList.add('open');
    inicializarTagsPicker();
    document.getElementById('inputTitulo')?.focus();
}
function fecharModalPublicar() {
    document.getElementById('modalOverlay')?.classList.remove('open');
    document.getElementById('formPublicar')?.reset();
    tagsSelecionadas = new Set();
    const picker = document.getElementById('tagsPicker');
    if (picker) picker.querySelectorAll('.tag-opcao').forEach(b => b.classList.remove('selecionada'));
    atualizarTagsSelecionadas();
}
async function publicarArtigo(e) {
    e.preventDefault();
    const btn = document.getElementById('btnPublicarSubmit');
    btn.disabled = true; btn.textContent = 'Publicando…';

    const novoArtigo = {
        titulo:    document.getElementById('inputTitulo').value.trim(),
        descricao: document.getElementById('inputDescricao').value.trim(),
        conteudo:  document.getElementById('inputConteudo').value.trim(),
        materia:   document.getElementById('inputMateria').value,
        autor:     document.getElementById('inputAutor').value.trim() || 'Anônimo',
        uid:       usuarioAtual?.uid || null,
        tags:      document.getElementById('inputTags').value.split(',').map(t=>t.trim()).filter(Boolean),
        likes: 0, totalComentarios: 0,
        createdAt: new Date(),
    };
    if (!novoArtigo.titulo || !novoArtigo.descricao || !novoArtigo.materia) {
        mostrarToast('Preencha os campos obrigatórios!','erro');
        btn.disabled=false; btn.textContent='🚀 Publicar agora'; return;
    }
    if (firebaseReady) {
        try {
            const ref = await db.collection('artigos').add({
                ...novoArtigo,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            novoArtigo.id = ref.id;
            mostrarToast('✅ Artigo publicado!','sucesso');
        } catch(err) {
            mostrarToast('Erro ao publicar no banco.','erro');
            btn.disabled=false; btn.textContent='🚀 Publicar agora'; return;
        }
    } else {
        novoArtigo.id = 'local_'+Date.now();
        mostrarToast('✅ Artigo adicionado (Firebase offline)','sucesso');
    }
    todosArtigos.unshift(novoArtigo);
    atualizarContadores();
    renderizarArtigos();
    fecharModalPublicar();
    btn.disabled=false; btn.textContent='🚀 Publicar agora';
}

// ── Selos de matéria ──────────────────────────
async function carregarSelosPerfil() {
    if (!usuarioAtual) return;
    const container = document.getElementById('perfilSelos');
    if (!container) return;
    let selos = [];
    if (firebaseReady) {
        try {
            const doc = await db.collection('usuarios').doc(usuarioAtual.uid).get();
            selos = doc.exists ? (doc.data().selos || []) : [];
        } catch(e) { console.warn(e); }
    }
    container.innerHTML = selos.length
        ? selos.map(s=>`<span class="badge badge-roxo badge-selo">${s}</span>`).join('')
        : '<span style="font-size:0.78rem;color:var(--cinza)">Nenhum selo ainda</span>';
}

function abrirModalSelos() {
    const grid = document.getElementById('selosGrid');
    // Pega selos atuais
    const atuais = Array.from(document.querySelectorAll('#perfilSelos .badge'))
        .map(b => b.textContent.trim());
    grid.innerHTML = MATERIAS.map(m => `
        <label class="selo-opcao ${atuais.includes(m)?'selecionado':''}">
            <input type="checkbox" value="${m}" ${atuais.includes(m)?'checked':''} style="display:none">
            ${m}
        </label>
    `).join('');
    grid.querySelectorAll('.selo-opcao').forEach(label => {
        label.addEventListener('click', () => label.classList.toggle('selecionado'));
    });
    document.getElementById('modalSelosOverlay')?.classList.add('open');
}
function fecharModalSelos() {
    document.getElementById('modalSelosOverlay')?.classList.remove('open');
}
async function salvarSelos() {
    const selos = Array.from(document.querySelectorAll('#selosGrid .selo-opcao.selecionado'))
        .map(l => l.querySelector('input').value);
    if (firebaseReady && usuarioAtual) {
        try {
            await db.collection('usuarios').doc(usuarioAtual.uid).set({ selos }, { merge: true });
        } catch(e) { console.warn(e); }
    }
    const container = document.getElementById('perfilSelos');
    if (container) {
        container.innerHTML = selos.length
            ? selos.map(s=>`<span class="badge badge-roxo badge-selo">${s}</span>`).join('')
            : '<span style="font-size:0.78rem;color:var(--cinza)">Nenhum selo ainda</span>';
    }
    fecharModalSelos();
    mostrarToast('🏷️ Selos salvos!','sucesso');
}

// ── Agenda ────────────────────────────────────
async function salvarAgenda(texto) {
    const btn = document.getElementById('saveNotesBtn');
    if (btn) { btn.disabled=true; btn.textContent='Salvando…'; }
    const uid = usuarioAtual?.uid || 'anonimo';
    if (firebaseReady && usuarioAtual) {
        try {
            await db.collection('agendas').doc(uid).set({
                notas: texto, atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            mostrarToast('📝 Agenda salva!','sucesso');
        } catch(e) { localStorage.setItem('notes_'+uid, texto); mostrarToast('📝 Salvo localmente',''); }
    } else {
        localStorage.setItem('notes_'+uid, texto);
        mostrarToast('📝 Agenda salva!','sucesso');
    }
    if (btn) { btn.disabled=false; btn.textContent='Salvar agenda'; }
}
async function carregarAgenda() {
    const ta = document.getElementById('notesTextarea');
    if (!ta) return;
    const uid = usuarioAtual?.uid || 'anonimo';
    if (firebaseReady && usuarioAtual) {
        try {
            const doc = await db.collection('agendas').doc(uid).get();
            if (doc.exists) { ta.value = doc.data().notas||''; return; }
        } catch(e) { console.warn(e); }
    }
    ta.value = localStorage.getItem('notes_'+uid) || '';
}

// ── Utilitários ───────────────────────────────
function mostrarToast(msg, tipo) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'show'+(tipo==='erro'?' toast-erro':tipo==='sucesso'?' toast-sucesso':'');
    clearTimeout(window._tt);
    window._tt = setTimeout(() => { t.className=''; }, 3200);
}
function formatarData(ts) {
    if (!ts) return 'Agora';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return 'Recente';
    return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
}
function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function atualizarContadores() {
    const el = document.getElementById('statArtigos');
    if (el) el.textContent = todosArtigos.length >= 1000
        ? (todosArtigos.length/1000).toFixed(1)+'k'
        : String(todosArtigos.length);
}

// ── Dados de exemplo ──────────────────────────
function dadosExemplo() {
    return [
        { id:'ex1', titulo:'Guia completo de funções do 2º grau para o ENEM',
          descricao:'Entenda de vez como funcionam as parábolas, vértice, delta e todas as propriedades que mais caem nas provas.',
          conteudo:'As funções do 2º grau (ou funções quadráticas) têm a forma f(x) = ax² + bx + c, onde a ≠ 0.\n\n📐 Vértice: V = (-b/2a, -Δ/4a)\n\n📌 Delta: Δ = b² - 4ac\n• Δ > 0 → dois raízes reais distintas\n• Δ = 0 → uma raiz real\n• Δ < 0 → sem raízes reais\n\nO gráfico é uma parábola:\n• a > 0 → abre para cima (mínimo)\n• a < 0 → abre para baixo (máximo)\n\nExemplo: f(x) = x² - 5x + 6\nΔ = 25 - 24 = 1\nx = (5 ± 1)/2 → x = 3 ou x = 2',
          materia:'Matemática', autor:'Carlos Menezes', tags:['funções','ENEM','parábola'],
          likes:48, destaque:true, createdAt:new Date('2026-05-28'), totalComentarios:2 },
        { id:'ex2', titulo:'Como escrever uma redação nota 1000 no ENEM',
          descricao:'Dicas práticas de estrutura, coesão, coerência e proposta de intervenção.',
          conteudo:'Uma redação nota 1000 precisa ter:\n\n1️⃣ INTRODUÇÃO: apresente o tema e tese clara\n2️⃣ DESENVOLVIMENTO (2 parágrafos): argumente com dados, exemplos e causas\n3️⃣ CONCLUSÃO: proposta de intervenção com: agente + ação + meio + finalidade + detalhamento\n\nDicas de ouro:\n• Use conectivos variados (ademais, outrossim, entretanto)\n• Cite filósofos, dados do IBGE, leis\n• Nunca fuja do tema\n• Cuide da ortografia e acentuação',
          materia:'Português', autor:'Mariana Lima', tags:['redação','ENEM','dissertação'],
          likes:36, destaque:false, createdAt:new Date('2026-05-27'), totalComentarios:0 },
        { id:'ex3', titulo:'Fotossíntese e respiração celular: diferenças',
          descricao:'Um resumo didático dos dois processos mais cobrados em Biologia, com esquemas e macetes.',
          conteudo:'🌱 FOTOSSÍNTESE\nOcorre: cloroplastos\nEquação: 6CO₂ + 6H₂O + luz → C₆H₁₂O₆ + 6O₂\nFase clara: grana (tilacóides) → produz ATP e NADPH\nFase escura: estroma → Ciclo de Calvin → glicose\n\n🔥 RESPIRAÇÃO CELULAR\nOcorre: mitocôndrias\nEquação: C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ATP\nEtapas: Glicólise → Ciclo de Krebs → Fosforilação oxidativa\n\nMacete: FOTOssíntese = usa LUZ para FAZER comida. Respiração = QUEBRA comida para gerar ENERGIA.',
          materia:'Ciências', autor:'Pedro Alves', tags:['biologia','fotossíntese','célula'],
          likes:29, destaque:false, createdAt:new Date('2026-05-26'), totalComentarios:0 },
        { id:'ex4', titulo:'Revolução Industrial: causas e impactos',
          descricao:'Contexto histórico, invenções e transformações sociais. Resumo completo para provas e vestibulares.',
          conteudo:'📅 PERÍODO: ~1760-1840 (1ª Revolução) | 1850-1914 (2ª Revolução)\n\n🇬🇧 CAUSAS (Inglaterra):\n• Reservas de carvão e ferro\n• Revolução Agrícola → êxodo rural → mão de obra\n• Capital acumulado pelo colonialismo\n• Estabilidade política\n\n⚙️ INVENÇÕES:\n• Máquina a vapor (James Watt, 1769)\n• Tear mecânico\n• Locomotiva\n\n🏭 IMPACTOS:\n• Surgimento do proletariado\n• Urbanização acelerada\n• Condições de trabalho precárias\n• Surgimento do socialismo e marxismo como resposta',
          materia:'História', autor:'Laura Mendes', tags:['industrial','século XVIII','vestibular'],
          likes:22, destaque:false, createdAt:new Date('2026-05-25'), totalComentarios:0 },
    ];
}
