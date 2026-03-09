// =============================================
// Estado global
// =============================================
let alunos = [];
let aulas = [];
let inscricoes = [];
let painelData = [];

// =============================================
// Inicialização
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupModal();
  setupCadastroForm();
  loadAllData();
});

async function loadAllData() {
  try {
    const [aulasRes, alunosRes, inscricoesRes, painelRes] = await Promise.all([
      fetch('/api/aulas').then(r => r.json()),
      fetch('/api/alunos').then(r => r.json()),
      fetch('/api/inscricoes').then(r => r.json()),
      fetch('/api/painel').then(r => r.json())
    ]);
    aulas = aulasRes;
    alunos = alunosRes;
    inscricoes = inscricoesRes;
    painelData = painelRes;

    renderPainel();
    renderAulasNav();
    renderAlunos();
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
  }
}

// =============================================
// Navegação entre seções
// =============================================
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(section).classList.add('active');
    });
  });
}

// =============================================
// Modal
// =============================================
function setupModal() {
  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close');

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
}

function openModal(titulo, html) {
  document.getElementById('modal-titulo').textContent = titulo;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// =============================================
// PAINEL DE SEMINÁRIOS
// =============================================
function renderPainel() {
  renderPainelStats();
  renderPainelGrid();
}

function renderPainelStats() {
  const totalAulas = painelData.length;
  const completas = painelData.filter(p => p.status === 'completa').length;
  const totalInscritos = new Set(inscricoes.map(i => i.alunoId)).size;
  const totalAlunos = alunos.length;

  document.getElementById('painel-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-number">${totalAulas}</div>
      <div class="stat-label">Seminários</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${completas}/${totalAulas}</div>
      <div class="stat-label">Completos (min. 2)</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${totalAlunos}</div>
      <div class="stat-label">Alunos cadastrados</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${inscricoes.length}</div>
      <div class="stat-label">Inscrições totais</div>
    </div>
  `;
}

function renderPainelGrid() {
  const grid = document.getElementById('painel-grid');

  if (painelData.length === 0) {
    grid.innerHTML = '<div class="empty-state">Carregando seminários...</div>';
    return;
  }

  grid.innerHTML = painelData.map(aula => {
    const statusClass = aula.inscritos.length >= 2 ? 'status-completa' :
                        aula.inscritos.length > 0 ? 'status-precisa' : 'status-vazia';

    const vagasText = aula.vagas > 0
      ? `${aula.vagas} vaga${aula.vagas > 1 ? 's' : ''} disponível${aula.vagas > 1 ? 'is' : ''}`
      : 'Sem vagas';

    const vagasClass = aula.inscritos.length >= 2 ? 'completa' : 'precisa';

    const inscritosHTML = aula.inscritos.length > 0
      ? `<div class="inscritos-lista">
          ${aula.inscritos.map(a => `
            <div class="inscrito-card">
              <div class="inscrito-info">
                <span class="inscrito-nome">${a.nome}</span>
                ${a.textoTitulo ? `<span class="inscrito-texto" title="${a.textoAutor}">${a.textoAutor.split(',')[0]} — ${a.textoTitulo}</span>` : ''}
              </div>
              <button class="remove-inscricao" onclick="removerInscricao('${a.inscricaoId}')" title="Remover inscrição">&times;</button>
            </div>
          `).join('')}
        </div>`
      : '<span style="font-size:0.82rem;color:#999;display:block;padding:0.3rem 0">Nenhum inscrito ainda</span>';

    return `
      <div class="aula-card ${statusClass}">
        <div class="aula-card-header">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="aula-numero">Aula ${aula.aulaId}</span>
            ${aula.data ? `<span class="aula-data">${aula.data}</span>` : ''}
          </div>
          <h3>${aula.titulo}</h3>
        </div>
        <div class="aula-card-body">
          <p class="aula-desc">${aula.subtitulo}</p>
          <div style="font-size:0.78rem;color:var(--cor-texto-light);margin-bottom:0.5rem">${aula.totalTextos} texto${aula.totalTextos > 1 ? 's' : ''}</div>
          <div class="aula-card-label">Apresentadores:</div>
          ${inscritosHTML}
          <div class="vagas-info ${vagasClass}">${vagasText} · Min. 2 alunos</div>
        </div>
        <div class="aula-card-footer">
          <button class="btn btn-sm btn-outline" onclick="abrirInscricao(${aula.aulaId})"
            ${aula.vagas <= 0 ? 'disabled' : ''}>
            Inscrever-se
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// --- Inscrição via modal (2 etapas: aluno → texto) ---
function abrirInscricao(aulaId) {
  const aula = painelData.find(a => a.aulaId === aulaId);
  if (!aula) return;

  // Filtrar alunos que já estão inscritos nesta aula
  const inscritosIds = new Set(aula.inscritos.map(i => i.id));
  const alunosDisponiveis = alunos.filter(a => !inscritosIds.has(a.id));

  let bodyHTML;
  if (alunos.length === 0) {
    bodyHTML = `
      <div class="empty-state">
        <p>Nenhum aluno cadastrado.</p>
        <p style="margin-top:0.5rem">Vá para a aba <strong>Cadastro</strong> para adicionar alunos.</p>
      </div>
    `;
  } else if (alunosDisponiveis.length === 0) {
    bodyHTML = `
      <div class="empty-state">
        <p>Todos os alunos já estão inscritos nesta aula.</p>
      </div>
    `;
  } else {
    bodyHTML = `
      <p style="font-size:0.85rem;color:var(--cor-texto-light);margin-bottom:0.8rem">
        <strong>Etapa 1:</strong> Selecione o aluno
      </p>
      <ul class="modal-aluno-list">
        ${alunosDisponiveis.map(a => `
          <li>
            <div>
              <span class="nome">${a.nome}</span>
              ${a.email ? `<br><span class="email">${a.email}</span>` : ''}
            </div>
            <button class="btn btn-sm btn-primary" onclick="escolherTexto('${a.id}', ${aulaId})">
              Selecionar
            </button>
          </li>
        `).join('')}
      </ul>
    `;
  }

  openModal(`Aula ${aulaId} — ${aula.titulo}`, bodyHTML);
}

function escolherTexto(alunoId, aulaId) {
  const aula = painelData.find(a => a.aulaId === aulaId);
  const aluno = alunos.find(a => a.id === alunoId);
  if (!aula || !aluno) return;

  const bodyHTML = `
    <p style="font-size:0.85rem;color:var(--cor-texto-light);margin-bottom:0.5rem">
      <strong>Etapa 2:</strong> Escolha o texto que <strong>${aluno.nome}</strong> vai apresentar
    </p>
    <ul class="modal-texto-list">
      ${aula.textos.map(t => {
        const jaEscolhido = aula.inscritos.find(i => i.textoId === t.id);
        const ocupado = jaEscolhido ? `<span class="texto-ocupado">Escolhido por ${jaEscolhido.nome}</span>` : '';
        return `
          <li class="${jaEscolhido ? 'texto-indisponivel' : ''}">
            <div>
              <span class="texto-autor">${t.autor}</span>
              <span class="texto-titulo">${t.titulo}</span>
              ${ocupado}
            </div>
            ${!jaEscolhido ? `
              <button class="btn btn-sm btn-primary" onclick="inscreverAluno('${alunoId}', ${aulaId}, '${t.id}')">
                Escolher
              </button>
            ` : ''}
          </li>
        `;
      }).join('')}
    </ul>
    <button class="btn btn-sm btn-outline" style="margin-top:0.8rem" onclick="abrirInscricao(${aulaId})">
      &larr; Voltar
    </button>
  `;

  openModal(`Aula ${aulaId} — ${aula.titulo}`, bodyHTML);
}

async function inscreverAluno(alunoId, aulaId, textoId) {
  try {
    const res = await fetch('/api/inscricoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alunoId, aulaId, textoId })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.erro || 'Erro ao inscrever');
      return;
    }

    closeModal();
    await loadAllData();
  } catch (err) {
    alert('Erro de conexão');
  }
}

async function removerInscricao(inscricaoId) {
  if (!confirm('Remover esta inscrição?')) return;

  try {
    const res = await fetch(`/api/inscricoes/${inscricaoId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.erro || 'Erro ao remover');
      return;
    }
    await loadAllData();
  } catch (err) {
    alert('Erro de conexão');
  }
}

// =============================================
// CONTEÚDO DAS AULAS
// =============================================
function renderAulasNav() {
  const nav = document.getElementById('aulas-nav');
  nav.innerHTML = aulas.map((aula, idx) => `
    <button class="aula-nav-btn ${idx === 0 ? 'active' : ''}"
            data-aula-id="${aula.id}"
            onclick="selecionarAula(${aula.id}, this)">
      Aula ${aula.id}
    </button>
  `).join('');

  // Renderizar primeira aula
  if (aulas.length > 0) {
    renderConteudoAula(aulas[0].id);
  }
}

function selecionarAula(aulaId, btn) {
  document.querySelectorAll('.aula-nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderConteudoAula(aulaId);
}

function renderConteudoAula(aulaId) {
  const aula = aulas.find(a => a.id === aulaId);
  if (!aula) return;

  const container = document.getElementById('conteudo-detalhe');

  container.innerHTML = `
    <div class="conteudo-aula">
      <div class="conteudo-aula-header">
        <h3>Aula ${aula.id} — ${aula.titulo}</h3>
        <p>${aula.subtitulo}</p>
      </div>

      ${aula.textos.map(texto => `
        <div class="texto-card" id="texto-${texto.id}">
          <div class="texto-card-header" onclick="toggleTexto('${texto.id}')">
            <div>
              <div class="autor">${texto.autor}</div>
              <div class="titulo-texto">${texto.titulo}</div>
            </div>
            <span class="toggle-icon">&#9660;</span>
          </div>
          <div class="texto-card-body">
            <div class="texto-resumo">${texto.resumo}</div>

            <div class="texto-section-title">Pontos-chave</div>
            <ul class="pontos-chave">
              ${texto.pontosChave.map(p => `<li>${p}</li>`).join('')}
            </ul>

            <div class="texto-section-title">Conexões com outros textos do programa</div>
            <ul class="conexoes-list">
              ${texto.conexoes.map(c => `<li>${c}</li>`).join('')}
            </ul>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function toggleTexto(textoId) {
  const card = document.getElementById(`texto-${textoId}`);
  card.classList.toggle('open');
}

// =============================================
// CADASTRO DE ALUNOS
// =============================================
function setupCadastroForm() {
  const form = document.getElementById('form-cadastro');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    const telefone = document.getElementById('telefone').value.trim();
    const msgEl = document.getElementById('form-msg');

    if (!nome) {
      showMsg(msgEl, 'Preencha o nome.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/alunos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, telefone })
      });

      const data = await res.json();

      if (!res.ok) {
        showMsg(msgEl, data.erro || 'Erro ao cadastrar', 'error');
        return;
      }

      showMsg(msgEl, `${data.nome} cadastrado com sucesso!`, 'success');
      form.reset();
      await loadAllData();
    } catch (err) {
      showMsg(msgEl, 'Erro de conexão com o servidor', 'error');
    }
  });
}

function renderAlunos() {
  const container = document.getElementById('lista-alunos');

  if (alunos.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhum aluno cadastrado ainda.</div>';
    return;
  }

  container.innerHTML = alunos.map(a => `
    <div class="aluno-card">
      <div class="aluno-info">
        <div class="aluno-nome">${a.nome}</div>
        <div class="aluno-details">
          ${a.telefone ? `<span class="aluno-telefone">${a.telefone}</span>` : ''}
          ${a.email ? `<span class="aluno-email">${a.email}</span>` : ''}
        </div>
      </div>
      <button class="btn-delete" onclick="removerAluno('${a.id}')" title="Remover aluno">&#10005;</button>
    </div>
  `).join('');
}

async function removerAluno(id) {
  if (!confirm('Remover este aluno? Suas inscrições também serão removidas.')) return;

  try {
    const res = await fetch(`/api/alunos/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.erro || 'Erro ao remover');
      return;
    }
    await loadAllData();
  } catch (err) {
    alert('Erro de conexão');
  }
}

// =============================================
// Utilitários
// =============================================
function showMsg(el, text, type) {
  el.textContent = text;
  el.className = `form-msg ${type}`;
  if (type === 'success') {
    setTimeout(() => { el.textContent = ''; el.className = 'form-msg'; }, 4000);
  }
}
