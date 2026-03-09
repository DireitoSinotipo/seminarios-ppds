const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3030;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers para ler/escrever JSON ---
const DATA_DIR = path.join(__dirname, 'data');

function readJSON(filename) {
  const filepath = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function writeJSON(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

// ======================
// API ROUTES
// ======================

// --- Aulas (programa do curso) ---
app.get('/api/aulas', (req, res) => {
  const aulas = readJSON('aulas.json');
  res.json(aulas);
});

app.get('/api/aulas/:id', (req, res) => {
  const aulas = readJSON('aulas.json');
  const aula = aulas.find(a => a.id === parseInt(req.params.id));
  if (!aula) return res.status(404).json({ erro: 'Aula não encontrada' });
  res.json(aula);
});

// --- Alunos (cadastro) ---
app.get('/api/alunos', (req, res) => {
  const alunos = readJSON('alunos.json');
  res.json(alunos);
});

app.post('/api/alunos', (req, res) => {
  const { nome, email, telefone } = req.body;
  if (!nome) {
    return res.status(400).json({ erro: 'Nome é obrigatório' });
  }

  const alunos = readJSON('alunos.json');

  // Verificar nome duplicado
  if (alunos.find(a => a.nome.toLowerCase() === nome.trim().toLowerCase())) {
    return res.status(409).json({ erro: 'Aluno já cadastrado' });
  }

  // Verificar email duplicado (se fornecido)
  if (email && alunos.find(a => a.email && a.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ erro: 'Email já cadastrado' });
  }

  const novoAluno = {
    id: crypto.randomUUID(),
    nome: nome.trim(),
    email: email ? email.trim().toLowerCase() : '',
    telefone: telefone ? telefone.trim() : '',
    criadoEm: new Date().toISOString()
  };

  alunos.push(novoAluno);
  writeJSON('alunos.json', alunos);
  res.status(201).json(novoAluno);
});

app.delete('/api/alunos/:id', (req, res) => {
  let alunos = readJSON('alunos.json');
  const index = alunos.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ erro: 'Aluno não encontrado' });

  // Remover inscrições do aluno
  let inscricoes = readJSON('inscricoes.json');
  inscricoes = inscricoes.filter(i => i.alunoId !== req.params.id);
  writeJSON('inscricoes.json', inscricoes);

  alunos.splice(index, 1);
  writeJSON('alunos.json', alunos);
  res.json({ mensagem: 'Aluno removido' });
});

// --- Inscrições (escolha de seminários) ---
app.get('/api/inscricoes', (req, res) => {
  const inscricoes = readJSON('inscricoes.json');
  res.json(inscricoes);
});

app.post('/api/inscricoes', (req, res) => {
  const { alunoId, aulaId, textoId } = req.body;
  if (!alunoId || !aulaId || !textoId) {
    return res.status(400).json({ erro: 'alunoId, aulaId e textoId são obrigatórios' });
  }

  const alunos = readJSON('alunos.json');
  const aulas = readJSON('aulas.json');
  const inscricoes = readJSON('inscricoes.json');

  // Validações
  if (!alunos.find(a => a.id === alunoId)) {
    return res.status(404).json({ erro: 'Aluno não encontrado' });
  }
  const aula = aulas.find(a => a.id === parseInt(aulaId));
  if (!aula) {
    return res.status(404).json({ erro: 'Aula não encontrada' });
  }

  // Validar texto pertence à aula
  const texto = aula.textos.find(t => t.id === textoId);
  if (!texto) {
    return res.status(404).json({ erro: 'Texto não encontrado nesta aula' });
  }

  // Verificar se já está inscrito nesta aula
  if (inscricoes.find(i => i.alunoId === alunoId && i.aulaId === parseInt(aulaId))) {
    return res.status(409).json({ erro: 'Aluno já inscrito nesta aula' });
  }

  // Verificar limite máximo (5 alunos por aula)
  const inscritosNaAula = inscricoes.filter(i => i.aulaId === parseInt(aulaId));
  if (inscritosNaAula.length >= 5) {
    return res.status(400).json({ erro: 'Limite de 5 alunos por aula atingido' });
  }

  const novaInscricao = {
    id: crypto.randomUUID(),
    alunoId,
    aulaId: parseInt(aulaId),
    textoId,
    criadoEm: new Date().toISOString()
  };

  inscricoes.push(novaInscricao);
  writeJSON('inscricoes.json', inscricoes);
  res.status(201).json(novaInscricao);
});

app.delete('/api/inscricoes/:id', (req, res) => {
  let inscricoes = readJSON('inscricoes.json');
  const index = inscricoes.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ erro: 'Inscrição não encontrada' });

  inscricoes.splice(index, 1);
  writeJSON('inscricoes.json', inscricoes);
  res.json({ mensagem: 'Inscrição removida' });
});

// --- Rota de resumo (painel) ---
app.get('/api/painel', (req, res) => {
  const aulas = readJSON('aulas.json');
  const alunos = readJSON('alunos.json');
  const inscricoes = readJSON('inscricoes.json');

  const painel = aulas.map(aula => {
    const inscricoesAula = inscricoes.filter(i => i.aulaId === aula.id);

    const inscritos = inscricoesAula.map(i => {
      const aluno = alunos.find(a => a.id === i.alunoId);
      const texto = aula.textos.find(t => t.id === i.textoId);
      return aluno ? {
        inscricaoId: i.id,
        id: aluno.id,
        nome: aluno.nome,
        email: aluno.email,
        textoId: i.textoId || '',
        textoTitulo: texto ? texto.titulo : '',
        textoAutor: texto ? texto.autor : ''
      } : null;
    }).filter(Boolean);

    return {
      aulaId: aula.id,
      titulo: aula.titulo,
      subtitulo: aula.subtitulo,
      data: aula.data || '',
      totalTextos: aula.textos.length,
      textos: aula.textos.map(t => ({ id: t.id, titulo: t.titulo, autor: t.autor })),
      inscritos,
      vagas: 5 - inscritos.length,
      status: inscritos.length >= 2 ? 'completa' : 'precisa_alunos'
    };
  });

  res.json(painel);
});

// --- SPA fallback ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════════════╗`);
  console.log(`  ║  Seminários PPDS - Servidor rodando!              ║`);
  console.log(`  ║  http://localhost:${PORT}                            ║`);
  console.log(`  ╚══════════════════════════════════════════════════╝\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ERRO: Porta ${PORT} já está em uso!`);
    console.error(`  Tente: set PORT=3031 && node server.js\n`);
  } else {
    console.error('Erro ao iniciar servidor:', err);
  }
  process.exit(1);
});
