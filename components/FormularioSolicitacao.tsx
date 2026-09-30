'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import UploadFotos from './UploadFotos'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Image from 'next/image'


type Cidade = { id: number; nome: string }
type OpcaoRelacional = { id: number; descricao: string }

const OPCOES_SINAIS_RISCO = [
  'Inclinação',
  'Rachadura',
  'Cupim / xilófagos',
  'Raízes expostas',
  'Podridão',
  'Danos a muro, telhado ou construção',
  'Copa e/ou galhos secos',
  'Queda recente de galhos',
  'Proximidade de fiação elétrica',
  'Proximidade de edificação',
  'Erva-de-passarinho / parasitas',
  'Dano na calçada/fundação',
]

export default function FormularioSolicitacao() {
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')
  const [avisoLaudo, setAvisoLaudo] = useState('')
  const [laudoTexto, setLaudoTexto] = useState('')
  const [nivelRisco, setNivelRisco] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [fotos, setFotos] = useState<string[]>([])
  const [cidades, setCidades] = useState<Cidade[]>([])
  const [sinaisRisco, setSinaisRisco] = useState<string[]>([])
  const [opcoesLocalizacao, setOpcoesLocalizacao] = useState<OpcaoRelacional[]>([])
  const [opcoesMotivo, setOpcoesMotivo] = useState<OpcaoRelacional[]>([])

  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    cidade_id: '',
    endereco: '',
    id_localizacao: '',
    id_motivo: '',
    especie_provavel: '',
    altura_estimada: '',
    diametro_tronco: '',
    descricao_cliente: '',
    observacoes: '',
  })

  useEffect(() => {
    supabase
      .from('cidades')
      .select('id, nome')
      .then(({ data }) => {
        if (data) setCidades(data)
      })
  }, [])

  useEffect(() => {
    supabase
      .from('localizacao_arvore')
      .select('id_local_arvore, descricao')
      .order('id_local_arvore')
      .then(({ data, error }) => {
        if (error) {
          console.error('Erro ao buscar localizacao_arvore:', error)
          return
        }
        if (data) {
          setOpcoesLocalizacao(
            data.map((d) => ({ id: d.id_local_arvore, descricao: d.descricao }))
          )
        }
      })
  }, [])

  useEffect(() => {
    supabase
      .from('motivo_laudo')
      .select('id_motivo, descricao')
      .order('id_motivo')
      .then(({ data, error }) => {
        if (error) {
          console.error('Erro ao buscar motivo_laudo:', error)
          return
        }
        if (data) {
          setOpcoesMotivo(
            data.map((d) => ({ id: d.id_motivo, descricao: d.descricao }))
          )
        }
      })
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const toggleSinalRisco = (sinal: string) => {
    setSinaisRisco((prev) =>
      prev.includes(sinal) ? prev.filter((s) => s !== sinal) : [...prev, sinal]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    setAvisoLaudo('')

    if (fotos.length < 2) {
      setErro('Envie no mínimo 2 fotos da árvore.')
      setEnviando(false)
      return
    }

    if (!form.cidade_id) {
      setErro('Selecione a cidade.')
      setEnviando(false)
      return
    }

    if (!form.id_localizacao) {
      setErro('Selecione a localização da árvore.')
      setEnviando(false)
      return
    }

    if (!form.id_motivo) {
      setErro('Selecione o motivo do laudo.')
      setEnviando(false)
      return
    }

    const { data: solicitacao, error } = await supabase
      .from('solicitacoes')
      .insert([
        {
          nome: form.nome,
          email: form.email,
          telefone: form.telefone,
          cidade_id: Number(form.cidade_id),
          endereco: form.endereco,
          id_localizacao: Number(form.id_localizacao),
          id_motivo: Number(form.id_motivo),
          especie_provavel: form.especie_provavel,
          altura_estimada: form.altura_estimada ? Number(form.altura_estimada) : null,
          diametro_tronco: form.diametro_tronco ? Number(form.diametro_tronco) : null,
          
          observacoes: form.observacoes,
          sinais_risco: sinaisRisco,
          status: 'pendente',
        },
      ])
      .select()
      .single()

    if (error || !solicitacao) {
      setErro('Erro ao enviar solicitação. Tente novamente.')
      console.error('Erro Supabase (solicitacoes):', JSON.stringify(error, null, 2))
      setEnviando(false)
      return
    }

    const fotosPayload = fotos.map((url) => ({
      solicitacao_id: solicitacao.id,
      url,
    }))

    const { error: erroFotos } = await supabase.from('fotos').insert(fotosPayload)

    if (erroFotos) {
      console.error('Erro Supabase (fotos):', erroFotos)
    }

    const cidadeSelecionada = cidades.find((c) => c.id === Number(form.cidade_id))
    const localizacaoSelecionada = opcoesLocalizacao.find(
      (l) => l.id === Number(form.id_localizacao)
    )
    const motivoSelecionado = opcoesMotivo.find((m) => m.id === Number(form.id_motivo))

    try {
      const resposta = await fetch('/api/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solicitacao_id: solicitacao.id,
          nome: form.nome,
          email: form.email,
          telefone: form.telefone,
          cidade: cidadeSelecionada?.nome || '',
          endereco: form.endereco,
          localizacao_arvore: localizacaoSelecionada?.descricao || '',
          motivo: motivoSelecionado?.descricao || '',
          especie_provavel: form.especie_provavel,
          altura_estimada: form.altura_estimada,
          diametro_tronco: form.diametro_tronco,
          descricao_cliente: form.descricao_cliente,
          observacoes: form.observacoes,
          sinais_risco: sinaisRisco,
          fotos,
        }),
      })

      const resultado = await resposta.json()

      if (!resposta.ok || !resultado.ok) {
        console.error('Erro ao registrar solicitação para processamento:', resultado)
        setAvisoLaudo(
          'Sua solicitação foi salva, mas houve um problema ao iniciar o processamento do laudo. Nossa equipe será avisada e entrará em contato.'
        )
      } else {
        setLaudoTexto(resultado.laudo || '')
        setNivelRisco(resultado.nivel_risco || '')
        setPdfUrl(resultado.pdf_url || '')
      }
    } catch (err) {
      console.error('Erro ao chamar /api/notificar:', err)
      setAvisoLaudo(
        'Sua solicitação foi salva, mas houve um problema ao iniciar o processamento do laudo. Nossa equipe será avisada e entrará em contato.'
      )
    }

    setSucesso(true)
    setEnviando(false)
  }

 if (sucesso) {
  return (
    <div className="wrap">
      <div
        className="sec"
        style={{ maxWidth: 720, margin: '40px auto', textAlign: 'center' }}
      >
        <h2>Solicitação enviada!</h2>
        <p className="hint">
          A solicitação, o PDF e as fotos foram encaminhados por e-mail para
          nossa equipe.
        </p>
        {avisoLaudo && <p className="status err">{avisoLaudo}</p>}
      </div>
    </div>
  )
}


  return (
    <div className="wrap">
      <header className="top">
      <div className="brandrow">
      <Image
      src="/logo-arborlaudo.png"
      alt="Arbor Laudo"
      width={250}
      height={250}
      
      style={{ objectFit: 'contain' }}
      priority
    />
     <div className="brand">
      <h1>Pré-Laudo Arbóreo</h1>
      <p>
        Envie fotos e informações da árvore. Sua solicitação será
        processada e um laudo será elaborado para revisão do biólogo
        responsável.
      </p>
    </div>
  </div>
</header>


      <div className="notice">
        <strong>Este é um pedido de avaliação.</strong> O laudo oficial só
        tem validade após vistoria, análise e assinatura do biólogo
        responsável, com registro no CRBio e ART.
      </div>

      <form onSubmit={handleSubmit}>
        <fieldset className="sec">
          <legend>
            <span className="n">A</span>Requerente
          </legend>
          <div className="row">
            <label className="f">
              Nome completo
              <input
                name="nome"
                type="text"
                required
                value={form.nome}
                onChange={handleChange}
              />
            </label>
            <label className="f">
              E-mail
              <input
                name="email"
                type="text"
                required
                value={form.email}
                onChange={handleChange}
              />
            </label>
          </div>
          <div className="row">
            <label className="f">
              Telefone / WhatsApp
              <input
                name="telefone"
                type="text"
                required
                value={form.telefone}
                onChange={handleChange}
              />
            </label>
            <label className="f">
              Cidade
              <select name="cidade_id" required value={form.cidade_id} onChange={handleChange}>
                <option value="">Selecione a cidade</option>
                {cidades.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="sec">
          <legend>
            <span className="n">B</span>Localização da árvore
          </legend>
          <label className="f">
            Endereço da árvore
            <input
              name="endereco"
              type="text"
              required
              value={form.endereco}
              onChange={handleChange}
            />
          </label>

          <label className="f">
            Local onde a árvore está situada
            <select
              name="id_localizacao"
              required
              value={form.id_localizacao}
              onChange={handleChange}
            >
              <option value="">Selecione uma opção</option>
              {opcoesLocalizacao.map((opcao) => (
                <option key={opcao.id} value={opcao.id}>
                  {opcao.descricao}
                </option>
              ))}
            </select>
          </label>

          <div className="row">
            <label className="f">
              Espécie (se souber)
              <input
                name="especie_provavel"
                type="text"
                value={form.especie_provavel}
                onChange={handleChange}
              />
            </label>
            <label className="f">
              Altura estimada (m)
              <input
                name="altura_estimada"
                type="number"
                value={form.altura_estimada}
                onChange={handleChange}
              />
            </label>
            <label className="f">
              Diâmetro do tronco (cm)
              <input
                name="diametro_tronco"
                type="number"
                value={form.diametro_tronco}
                onChange={handleChange}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="sec">
          <legend>
            <span className="n">C</span>O que é pedido
          </legend>
          <label className="f">
            Motivo do laudo
            <select
              name="id_motivo"
              required
              value={form.id_motivo}
              onChange={handleChange}
            >
              <option value="">Selecione o motivo</option>
              {opcoesMotivo.map((opcao) => (
                <option key={opcao.id} value={opcao.id}>
                  {opcao.descricao}
                </option>
              ))}
            </select>
          </label>



          <label className="f">
            Descreva o problema
            <textarea
              name="observacoes"
              value={form.observacoes}
              onChange={handleChange}
            />
          </label>

          <div>
            <p className="hint" style={{ marginBottom: 6, fontWeight: 600 }}>
              Sinais de risco observados (marque se aplicável)
            </p>
            <div className="checks">
              {OPCOES_SINAIS_RISCO.map((sinal) => (
                <label key={sinal}>
                  <input
                    type="checkbox"
                    checked={sinaisRisco.includes(sinal)}
                    onChange={() => toggleSinalRisco(sinal)}
                  />
                  {sinal}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="sec">
          <legend>
            <span className="n">D</span>Fotos
          </legend>
          <UploadFotos onUploadComplete={setFotos} />
        </fieldset>

        {erro && <p className="status err">{erro}</p>}

        <div className="actions">
          <button type="submit" disabled={enviando} className="btn primary">
            {enviando ? 'Enviando... (pode levar até 1 minuto)' : 'Enviar solicitação'}
          </button>
        </div>
      </form>
    </div>
  )
}
