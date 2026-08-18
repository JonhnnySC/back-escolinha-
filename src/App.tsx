import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Aluno = { id: number; nome: string; matricula: string; nota: number; observacoes?: string }
type PageResponse = { content: Aluno[]; totalElements: number; totalPages: number; number: number; first: boolean; last: boolean }
type SearchMode = 'todos' | 'intervalo' | 'minima' | 'maxima' | 'nome'
type SortKey = 'nota' | 'nome' | 'matricula'
type AlunoForm = Omit<Aluno, 'id'>

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1/alunos'
const AUTH = `Basic ${btoa('admin:admin')}`
const PAGE_SIZE = 8
const emptyForm: AlunoForm = { nome: '', matricula: '', nota: 0, observacoes: '' }
const emptyPage: PageResponse = { content: [], totalElements: 0, totalPages: 0, number: 0, first: true, last: true }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', Authorization: AUTH, ...options?.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message ?? `Não foi possível concluir a operação (${response.status}).`)
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>
}

function App() {
  const [page, setPage] = useState<PageResponse>(emptyPage)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('intervalo')
  const [name, setName] = useState('')
  const [minimum, setMinimum] = useState('7')
  const [maximum, setMaximum] = useState('10')
  const [sortKey, setSortKey] = useState<SortKey>('nota')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Aluno | null>(null)
  const [form, setForm] = useState<AlunoForm>(emptyForm)

  const loadStudents = async (selectedPage = 0) => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ page: String(selectedPage), size: String(PAGE_SIZE), sort: `${sortKey},${sortDirection}` })
      let endpoint = API_URL
      if (searchMode === 'intervalo') { params.set('notaMinima', minimum); params.set('notaMaxima', maximum); endpoint += '/buscar/intervalo-nota' }
      if (searchMode === 'minima') { params.set('nota', minimum); endpoint += '/buscar/nota-minima' }
      if (searchMode === 'maxima') { params.set('nota', maximum); endpoint += '/buscar/nota-maxima' }
      if (searchMode === 'nome') { params.set('nome', name); endpoint += '/buscar/nome' }
      setPage(await request<PageResponse>(`${endpoint}?${params.toString()}`))
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar alunos.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadStudents(0) }, [searchMode, sortKey, sortDirection])
  const submitSearch = (event: FormEvent) => { event.preventDefault(); void loadStudents(0) }
  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setIsModalOpen(true) }
  const openEdit = (student: Aluno) => { setEditing(student); setForm({ nome: student.nome, matricula: student.matricula, nota: student.nota, observacoes: student.observacoes ?? '' }); setError(''); setIsModalOpen(true) }
  const closeModal = () => { setIsModalOpen(false); setEditing(null); setForm(emptyForm) }
  const updateForm = (field: keyof AlunoForm, value: string | number) => setForm((current) => ({ ...current, [field]: value }))

  const saveStudent = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.nome.trim() || !form.matricula.trim() || form.nota < 0 || form.nota > 10) { setError('Preencha nome, matrícula e uma nota entre 0 e 10.'); return }
    setSaving(true); setError('')
    try {
      const url = editing ? `${API_URL}/${editing.id}` : API_URL
      await request<Aluno>(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify({ ...form, nome: form.nome.trim(), matricula: form.matricula.trim() }) })
      setNotice(editing ? 'Aluno atualizado com sucesso.' : 'Aluno cadastrado com sucesso.'); closeModal(); void loadStudents(editing ? page.number : 0)
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar aluno.') }
    finally { setSaving(false) }
  }

  const deleteStudent = async (student: Aluno) => {
    if (!window.confirm(`Excluir o cadastro de ${student.nome}?`)) return
    try { await request<void>(`${API_URL}/${student.id}`, { method: 'DELETE' }); setNotice('Aluno removido.'); void loadStudents(page.number) }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Erro ao excluir aluno.') }
  }
  const toggleSort = (key: SortKey) => { if (sortKey === key) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDirection(key === 'nota' ? 'desc' : 'asc') } }
  const visibleStart = page.totalElements === 0 ? 0 : page.number * PAGE_SIZE + 1
  const visibleEnd = Math.min((page.number + 1) * PAGE_SIZE, page.totalElements)
  const average = page.content.length ? (page.content.reduce((sum, student) => sum + student.nota, 0) / page.content.length).toFixed(1).replace('.', ',') : '--'

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">S</span><div><strong>Sanscritinho</strong><span>Central acadêmica</span></div></div><div className="user-chip"><span className="status-dot" /> Admin</div></header>
    <section className="page-heading"><div><p className="eyebrow">PAINEL DE CONTROLE / 2024</p><h1>Gestão de alunos</h1><p className="heading-copy">Acompanhe o desempenho da sua turma com clareza.</p></div><button className="primary-button" type="button" onClick={openCreate}><span>+</span> Novo aluno</button></section>
    <section className="metric-row"><div className="metric"><span className="metric-label">ALUNOS CADASTRADOS</span><strong>{page.totalElements}</strong><span className="metric-note">na base consultada</span></div><div className="metric metric-highlight"><span className="metric-label">MÉDIA DA TURMA</span><strong>{average}</strong><span className="metric-note">notas nesta página</span></div><div className="metric"><span className="metric-label">STATUS DA API</span><strong className="api-status"><span className="status-dot" /> Online</strong><span className="metric-note">última consulta agora</span></div></section>
    <section className="workspace-panel"><div className="panel-head"><div><span className="section-kicker">CONSULTA INTELIGENTE</span><h2>Encontre um aluno</h2></div><span className="result-count">{page.totalElements} resultados</span></div><form className="search-form" onSubmit={submitSearch}><label className="field field-wide"><span>Tipo de busca</span><select value={searchMode} onChange={(event) => setSearchMode(event.target.value as SearchMode)}><option value="intervalo">Intervalo de nota</option><option value="nome">Nome do aluno</option><option value="minima">Nota mínima</option><option value="maxima">Nota máxima</option><option value="todos">Todos os alunos</option></select></label>{searchMode === 'nome' ? <label className="field field-wide"><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Maria Santos" /></label> : searchMode !== 'todos' && <><label className="field"><span>{searchMode === 'maxima' ? 'Nota máxima' : 'Nota mínima'}</span><input type="number" min="0" max="10" step="0.1" value={searchMode === 'maxima' ? maximum : minimum} onChange={(event) => searchMode === 'maxima' ? setMaximum(event.target.value) : setMinimum(event.target.value)} /></label>{searchMode === 'intervalo' && <label className="field"><span>Nota máxima</span><input type="number" min="0" max="10" step="0.1" value={maximum} onChange={(event) => setMaximum(event.target.value)} /></label>}</>}<button className="search-button" type="submit" disabled={loading}><span>⌕</span>{loading ? 'Buscando...' : 'Buscar alunos'}</button></form>{error && <div className="feedback error" role="alert">{error}</div>}{notice && <div className="feedback success" role="status">{notice}<button type="button" onClick={() => setNotice('')}>Fechar</button></div>}</section>
    <section className="results-panel"><div className="results-head"><div><span className="section-kicker">REGISTROS</span><h2>Alunos da turma</h2></div><div className="sort-control"><span>Ordenar por</span><select value={`${sortKey}-${sortDirection}`} onChange={(event) => { const [key, direction] = event.target.value.split('-') as [SortKey, 'asc' | 'desc']; setSortKey(key); setSortDirection(direction) }}><option value="nota-desc">Nota: maior primeiro</option><option value="nota-asc">Nota: menor primeiro</option><option value="nome-asc">Nome: A a Z</option><option value="nome-desc">Nome: Z a A</option><option value="matricula-asc">Matrícula: crescente</option></select></div></div><div className="table-wrap"><table><thead><tr><th>ID</th><th><button type="button" onClick={() => toggleSort('nome')}>Aluno</button></th><th><button type="button" onClick={() => toggleSort('matricula')}>Matrícula</button></th><th><button type="button" onClick={() => toggleSort('nota')}>Nota</button></th><th>Ações</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="empty-state"><span className="loader" /> Carregando registros...</td></tr> : page.content.length === 0 ? <tr><td colSpan={5} className="empty-state">Nenhum aluno encontrado para esta busca.</td></tr> : page.content.map((student) => <tr key={student.id}><td className="muted">#{student.id}</td><td><div className="student-cell"><span className="avatar">{student.nome.slice(0, 1).toUpperCase()}</span><strong>{student.nome}</strong></div></td><td className="muted">{student.matricula}</td><td><span className={`grade grade-${student.nota >= 7 ? 'good' : student.nota >= 5 ? 'attention' : 'low'}`}>{student.nota.toFixed(1).replace('.', ',')}</span></td><td><div className="actions"><button type="button" className="icon-button" title="Editar aluno" onClick={() => openEdit(student)}>✎</button><button type="button" className="icon-button danger" title="Excluir aluno" onClick={() => void deleteStudent(student)}>⌫</button></div></td></tr>)}</tbody></table></div><footer className="pagination"><span>Exibindo <strong>{visibleStart}-{visibleEnd}</strong> de <strong>{page.totalElements}</strong></span><div><button type="button" disabled={page.first || loading} onClick={() => void loadStudents(page.number - 1)}>‹ Anterior</button><span className="page-number">{page.totalPages ? page.number + 1 : 0} <small>/ {page.totalPages || 0}</small></span><button type="button" disabled={page.last || loading} onClick={() => void loadStudents(page.number + 1)}>Próximo ›</button></div></footer></section>
    {isModalOpen && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="section-kicker">{editing ? 'EDITAR REGISTRO' : 'NOVO REGISTRO'}</span><h2 id="modal-title">{editing ? 'Atualizar aluno' : 'Cadastrar aluno'}</h2></div><button type="button" className="close-button" onClick={closeModal} aria-label="Fechar">×</button></div><form onSubmit={saveStudent}><label className="field"><span>Nome completo</span><input required maxLength={150} value={form.nome} onChange={(event) => updateForm('nome', event.target.value)} placeholder="Nome do aluno" /></label><div className="form-grid"><label className="field"><span>Matrícula</span><input required maxLength={20} value={form.matricula} onChange={(event) => updateForm('matricula', event.target.value)} placeholder="2024001" /></label><label className="field"><span>Nota <small>(0 a 10)</small></span><input required type="number" min="0" max="10" step="0.1" value={form.nota} onChange={(event) => updateForm('nota', Number(event.target.value))} /></label></div><label className="field"><span>Observações <small>(opcional)</small></span><textarea maxLength={500} rows={4} value={form.observacoes} onChange={(event) => updateForm('observacoes', event.target.value)} placeholder="Registre um comentário sobre o desempenho..." /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={closeModal}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar aluno'}</button></div></form></div></div>}
  </main>
}

export default App
