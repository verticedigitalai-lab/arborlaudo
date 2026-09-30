export const runtime = 'nodejs' // no topo do arquivo route.ts
import { Resend } from 'resend'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import sharp from 'sharp'
import LaudoDocument from '@/components/pdf/LaudoDocument'
import { gerarLaudoDocx } from '@/components/pdf/LaudoDocx'

export const maxDuration = 120

const resend = new Resend(process.env.RESEND_API_KEY)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYSTEM_PROMPT = `Você é Frederico de Miranda Viana, Biólogo (CRBio 50740/01-S), especialista em 
avaliação fitossanitária e de risco de árvores urbanas. Sua tarefa é analisar as 
fotos e informações fornecidas pelo solicitante e gerar um laudo técnico formal, 
seguindo rigorosamente o padrão abaixo.

═══════════════════════════════════════
CONTEXTO LEGAL POR CIDADE (aplique de acordo com a cidade informada):
═══════════════════════════════════════

CURITIBA:
- Base legal: Lei nº 9.806/2000 (Código Florestal Municipal), Decreto nº 340/2022, Portaria SMMA nº 12/2022
- Órgão responsável: Secretaria Municipal do Meio Ambiente (SMMA)
- Corte/poda em imóvel particular exige ARP (Autorização Ambiental para Remoção de Vegetação) via Portal SIMA + SINAFLOR
- Corte/poda em área pública: solicitação via Central 156
- Documentação: relatório fotográfico com vista total, detalhes de copa, tronco e danos/doenças

SANTOS:
- Base legal: Lei Complementar nº 973/2017, atualizada pela LC nº 1.283/2024
- Vegetação de porte arbóreo: DAP ≥ 5cm
- Poda de mais de 50% da copa (poda drástica) exige laudo técnico justificando a medida, aprovado pelo órgão responsável
- Proibido manejo com ninhos de aves ativos, exceto risco iminente comprovado
- Multas de R$ 1.000 a R$ 50.000 em caso de manejo irregular

GUARUJÁ:
- Órgão responsável: Secretaria de Meio Ambiente e Segurança Climática (Semam)
- Regido pelo Plano Municipal de Arborização Urbana / Lei de Arborização
- Solicitações formais via Protocolo Geral do Paço Municipal; orientação inicial via Linha Verde
- Autorização de poda/supressão depende de avaliação técnica prévia da Semam

═══════════════════════════════════════
ANÁLISE A PARTIR DAS FOTOS:
═══════════════════════════════════════
Para cada árvore identificada nas fotos, extraia/estime:
1. Espécie (nome científico e nome comum) — se não for possível identificar com certeza, indique "espécie não identificada com precisão, sugere-se confirmação in loco"
2. Família botânica
3. Altura estimada (em metros)
4. DAP estimado (diâmetro à altura do peito, ~1,30m do solo) — se não houver referência de escala, informe "DAP estimado visualmente, sujeito a confirmação"
5. Estado fitossanitário: sadio / comprometido / crítico
6. Anomalias visíveis: inclinação (grau aproximado), rachaduras, cancros, podridão, parasitas (ex: erva-de-passarinho), orifícios de organismos xilófagos, raízes expostas, danos ao entorno
7. Fatores de risco do entorno: proximidade de edificações, fiação elétrica, vias, acessos

═══════════════════════════════════════
CLASSIFICAÇÃO DE RISCO:
═══════════════════════════════════════
- BAIXO: sem anomalias significativas
- MÉDIO: anomalias presentes, sem risco iminente
- ALTO: risco iminente de queda — sinalizar "RISCO EMINENTE — RECOMENDA-SE VISITA TÉCNICA PRESENCIAL"
═══════════════════════════════════════
LEGENDAS DAS FOTOS (uma por foto, na ordem recebida):
═══════════════════════════════════════
Para cada foto enviada, gere uma legenda curta e técnica (máx. 15 palavras) 
descrevendo o que é visível (ex: "Vista geral da árvore com inclinação sobre a via").
Formato exato (uma linha por foto, sem numeração adicional):
LEGENDA_FOTO_1: [texto]
LEGENDA_FOTO_2: [texto]
(...)

═══════════════════════════════════════
FORMATO DE SAÍDA (um bloco por árvore):
═══════════════════════════════════════

[Supressão/Poda/Avaliação N]: Nome científico: [espécie]. Nome comum: [nome]. Família: [família].

[Parágrafo técnico-narrativo: localização, dendrometria, estado fitossanitário, anomalias, riscos do entorno, conclusão com recomendação (poda/supressão/substituição/manutenção) e urgência.]

DAP: [valor]m e h= ± [valor]m.
Classificação de risco: [BAIXO/MÉDIO/ALTO]
Base legal aplicável: [citar lei/órgão da cidade]
Recomendação de trâmite: [ex: "Protocolar ARP junto à SMMA"]

═══════════════════════════════════════
TABELA RESUMO (ao final, formato Markdown):
═══════════════════════════════════════
| Espécie | Nome comum | DAP | Altura | Objeto | Risco | Compensação (mudas) | Origem |

═══════════════════════════════════════
RODAPÉ (fixo):
═══════════════════════════════════════
[Cidade],  [use exatamente a data fornecida em "Data de hoje" no contexto da solicitação — nunca invente ou estime a data].
Frederico de Miranda Viana.
Biólogo CRBio 50740/01-S.

REGRAS: Nunca invente dados não inferíveis das fotos — marque estimativas como tal. Seja técnico e formal. Sempre cite a legislação da cidade. Sempre inclua classificação de risco e recomendação de trâmite. Se risco ALTO, destaque isso no início do parágrafo.

Nunca invente a data do rodapé — use exatamente a data fornecida no campo "Data de hoje" do contexto da solicitação. 
Seja técnico e formal. Sempre cite a legislação da cidade. Sempre inclua classificação de risco e recomendação de trâmite. Se risco ALTO, destaque isso no início do parágrafo.

Ao final, retorne também uma linha separada no formato exato:
NIVEL_RISCO: [baixo|médio|alto]
RECOMENDACAO: [poda|remoção|monitoramento]

(essas duas linhas servem para parse automático pelo sistema, não remova nem altere o formato delas)`

type ImagemProcessada = {
  mimeType: 'image/jpeg'
  buffer: Buffer
  data: string
}

// Baixa a imagem e converte para um JPEG real usando sharp.
// O Buffer é preservado para bibliotecas de documentos; o base64 é usado
// somente nos lugares que exigem texto, como Gemini e a data URI do PDF.
async function urlParaImagem(url: string): Promise<ImagemProcessada | null> {
  try {
    const resposta = await fetch(url, {
      headers: { Accept: 'image/*' },
    })

    if (!resposta.ok) {
      const corpoErro = await resposta.text().catch(() => '(sem corpo)')
      console.error('Fetch falhou para', url)
      console.error('Status:', resposta.status, resposta.statusText)
      console.error('Headers:', JSON.stringify(Object.fromEntries(resposta.headers.entries())))
      console.error('Corpo do erro:', corpoErro)
      return null
    }

    const arrayBuffer = await resposta.arrayBuffer()
    const entrada = Buffer.from(arrayBuffer)

    if (!Buffer.isBuffer(entrada) || entrada.length === 0) {
      throw new Error(`A resposta da imagem está vazia ou não é um Buffer válido: ${url}`)
    }

    const jpegBuffer = await sharp(entrada, { failOn: 'none' })
      .rotate()
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()

    if (!Buffer.isBuffer(jpegBuffer) || jpegBuffer.length === 0) {
      throw new Error(`sharp não produziu um JPEG válido: ${url}`)
    }

    console.log('[Imagem] Conversão concluída', {
      url,
      entradaBytes: entrada.length,
      saidaBytes: jpegBuffer.length,
      entradaIsBuffer: Buffer.isBuffer(entrada),
      saidaIsBuffer: Buffer.isBuffer(jpegBuffer),
      assinatura: jpegBuffer.subarray(0, 3).toString('hex'),
    })

    return {
      mimeType: 'image/jpeg',
      buffer: jpegBuffer,
      data: jpegBuffer.toString('base64'),
    }
  } catch (err) {
    console.error('[Imagem] Erro ao baixar/converter imagem:', url)
    console.error(err instanceof Error ? err.stack : err)
    return null
  }
}



// Chama o Gemini com retry automático em caso de sobrecarga (503) ou rate limit (429)
async function gerarComRetryGemini(
  paramsBase: Omit<Parameters<typeof ai.models.generateContent>[0], 'model'>,
  tentativas = 5
) {
  const modelo = 'gemini-3.8-flash'
  let ultimoErro: any = null

  for (let i = 0; i < tentativas; i++) {
    try {
      return await ai.models.generateContent({ ...paramsBase, model: modelo })
    } catch (err: any) {
      ultimoErro = err
      const isErroTemporario = err?.status === 503 || err?.status === 429
      const isUltimaTentativa = i === tentativas - 1

      if (!isErroTemporario || isUltimaTentativa) throw err

      const espera = (i + 1) * 4000
      console.log(`[Gemini] Tentativa ${i + 1}/${tentativas} falhou (status ${err?.status}), aguardando ${espera}ms...`)
      await new Promise((resolve) => setTimeout(resolve, espera))
    }
  }

  throw ultimoErro ?? new Error('Falha ao gerar conteúdo após todas as tentativas.')
}

// Gera o laudo usando apenas o Gemini
async function gerarLaudo(
  textoContexto: string,
  imagensBase64: { mimeType: string; data: string }[]
): Promise<string> {
  const parts: any[] = [{ text: textoContexto }]
  for (const img of imagensBase64) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
  }

  const result = await gerarComRetryGemini({
    contents: [{ role: 'user', parts }],
    config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 4096 },
  })

  if (result?.text) return result.text
  throw new Error('Gemini retornou resposta vazia')
}

// Envia notificação por e-mail (não bloqueia o fluxo principal se falhar)
async function enviarEmailNotificacao(dados: {
  nome: string
  email: string
  telefone: string
  cidade: string
  endereco: string
  localizacao_arvore?: string
  motivo?: string
  descricao_cliente: string
  sinaisRiscoTexto: string
  observacoes?: string
  nivelRisco: string
  recomendacao: string
  laudoTexto: string
  pdfBuffer?: Buffer | null
  docxBuffer?: Buffer | null
}) {
  const {
    nome, email, telefone, cidade, endereco,
    localizacao_arvore, motivo,
    descricao_cliente, sinaisRiscoTexto, observacoes,
    nivelRisco, recomendacao, laudoTexto, pdfBuffer, docxBuffer,
  } = dados

  const laudoHtml = laudoTexto.split('\n').map((linha) => `<p>${linha}</p>`).join('')
  const tecnicoEmail = process.env.TECNICO_EMAIL || 'verticedigital.ai@gmail.com'

  const attachments: { filename: string; content: Buffer }[] = []
  if (pdfBuffer) attachments.push({ filename: 'laudo-tecnico.pdf', content: pdfBuffer })
  if (docxBuffer) attachments.push({ filename: 'laudo-tecnico.docx', content: docxBuffer })

  try {
    const resultado = await resend.emails.send({
      from: 'Notificações <onboarding@resend.dev>',
      to: tecnicoEmail,
      subject: `Laudo arbóreo gerado — ${cidade} — ${nome}`,
      html: `
        <h2>Nova solicitação de laudo arbóreo</h2>
        <p><strong>Nome:</strong> ${nome}</p>
        <p><strong>E-mail:</strong> ${email}</p>
        <p><strong>Telefone:</strong> ${telefone}</p>
        <p><strong>Cidade:</strong> ${cidade}</p>
        <p><strong>Endereço:</strong> ${endereco}</p>
        <p><strong>Localização da árvore:</strong> ${localizacao_arvore || '-'}</p>
        <p><strong>Motivo:</strong> ${motivo || '-'}</p>
        <p><strong>Sinais de risco:</strong> ${sinaisRiscoTexto}</p>
        <p><strong>Observações:</strong> ${observacoes || '-'}</p>
        <p><strong>Nível de risco (IA):</strong> ${nivelRisco}</p>
        <p><strong>Recomendação (IA):</strong> ${recomendacao}</p>
        <hr />
        <h3>Laudo Técnico (gerado por IA)</h3>
        ${laudoHtml}
      `,
      ...(attachments.length > 0 ? { attachments } : {}),
    })

    if (resultado.error) {
      console.error('Resend retornou erro:', resultado.error)
    } else {
      console.log('E-mail enviado com sucesso. ID:', resultado.data?.id)
    }
  } catch (erroEmail) {
    console.error('Falha ao enviar e-mail via Resend:', erroEmail)
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  try {
    const {
      solicitacao_id,
      nome,
      email,
      telefone,
      cidade,
      endereco,
      localizacao_arvore,
      motivo,
      especie_provavel,
      altura_estimada,
      diametro_tronco,
      descricao_cliente,
      observacoes,
      sinais_risco,
      fotos,
    } = body

    const sinaisRiscoTexto =
      Array.isArray(sinais_risco) && sinais_risco.length > 0
        ? sinais_risco.join(', ')
        : 'nenhum indicado pelo cliente'

    if (solicitacao_id) {
      await supabaseAdmin
        .from('solicitacoes')
        .update({ status: 'processando_laudo' })
        .eq('id', solicitacao_id)
    }

    const dataAtual = new Date().toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const dataCabecalhoPontos = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).replace(/\//g, '.')

    const textoContexto = `Dados da solicitação:
Data de hoje (usar exatamente esta data no rodapé do laudo): ${dataAtual}
Nome do cliente: ${nome}
Cidade: ${cidade}
Endereço: ${endereco}
Localização da árvore: ${localizacao_arvore || 'não informado'}
Motivo do laudo: ${motivo || 'não informado'}
Espécie informada pelo cliente (se houver): ${especie_provavel || 'não informado'}
Altura estimada informada: ${altura_estimada || 'não informado'}
Diâmetro do tronco informado: ${diametro_tronco || 'não informado'}

Sinais de risco indicados pelo cliente: ${sinaisRiscoTexto}
Observações: ${observacoes || '-'}

Analise as fotos anexadas e gere o laudo técnico completo seguindo o padrão estabelecido, considerando a legislação de ${cidade}. Use o campo "Motivo do laudo" (${motivo || 'não informado'}) como o objeto principal da avaliação (ex: se for "Remoção (Supressão)", o laudo deve tratar de supressão; se for "Poda", trate de poda; se for "Avaliação de Risco", foque na análise de risco; se for "Transplante", trate da viabilidade de transplante).`

    // Baixa e converte todas as fotos para JPEG, mantendo Buffer e base64
    // alinhados com o índice original de "fotos".
    const imagens: (ImagemProcessada | null)[] = []
    if (Array.isArray(fotos)) {
      for (const url of fotos) {
        const imagem = await urlParaImagem(url)
        imagens.push(imagem)
      }
    }

    // Gera o laudo (aguarda o resultado — sem background)
    const laudoTexto = await gerarLaudo(
      textoContexto,
      imagens.filter((img): img is ImagemProcessada => img !== null)
    )

    const nivelRiscoMatch = laudoTexto.match(/NIVEL_RISCO:\s*(\w+)/i)
    const recomendacaoMatch = laudoTexto.match(/RECOMENDACAO:\s*(.+)/i)
    const nivelRisco = nivelRiscoMatch ? nivelRiscoMatch[1].toLowerCase() : 'não informado'
    const recomendacao = recomendacaoMatch ? recomendacaoMatch[1].trim() : 'não informado'

    // Extrai legendas por foto geradas pela IA
    const legendas: string[] = []
    const regexLegenda = /LEGENDA_FOTO_(\d+):\s*(.+)/gi
    let matchLegenda
    while ((matchLegenda = regexLegenda.exec(laudoTexto)) !== null) {
      legendas[Number(matchLegenda[1]) - 1] = matchLegenda[2].trim()
    }

    // O PDF recebe o Buffer JPEG diretamente. Não passe base64 nem data URI
    // ao React-PDF: isso força o parser JPEG a trabalhar com texto.
    const fotosComLegenda = (Array.isArray(fotos) ? fotos : []).map((url: string, i: number) => {
      const img = imagens[i]
      return {
        url,
        buffer: img?.buffer,
        legenda: legendas[i] || 'Evidência fotográfica da árvore.',
      }
    })

    // Busca número sequencial do laudo
    const { data: solicitacaoInfo } = await supabaseAdmin
      .from('solicitacoes')
      .select('numero_laudo')
      .eq('id', solicitacao_id)
      .single()

    const numeroFormatado = solicitacaoInfo?.numero_laudo
      ? String(solicitacaoInfo.numero_laudo).padStart(2, '0')
      : '00'

    // Gera o PDF. As imagens chegam ao LaudoDocument como Buffer nativo.
    let pdfUrl: string | null = null
    let pdfBufferGerado: Buffer | null = null

    try {
      pdfBufferGerado = await renderToBuffer(
        LaudoDocument({
          interessado: nome,
          empreendimento: 'Residencial',
          endereco: `${endereco} - ${cidade}, SP`,
          assunto: descricao_cliente,
          numero: numeroFormatado,
          dataDoc: dataCabecalhoPontos,
          rev: '01',
          fotos: fotosComLegenda,
          laudoTexto,
          emissor: 'Frederico de Miranda Viana',
        })
      )

      const nomeArquivo = `laudo-${solicitacao_id}.pdf`
      const { error: erroUpload } = await supabaseAdmin.storage
        .from('laudos')
        .upload(nomeArquivo, pdfBufferGerado, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (!erroUpload) {
        const { data: publicUrlData } = supabaseAdmin.storage
          .from('laudos')
          .getPublicUrl(nomeArquivo)
        pdfUrl = publicUrlData.publicUrl
      } else {
        console.error('Erro ao subir PDF:', erroUpload)
      }
    } catch (erroPdf) {
      console.error('Erro ao gerar PDF:', erroPdf instanceof Error ? erroPdf.stack : erroPdf)
      throw erroPdf
    }

    // Gera o DOCX (uma única vez)
    let docxUrl: string | null = null
    let docxBufferGerado: Buffer | null = null

    try {
      const fotosDocx = fotosComLegenda
        .map((f, i) => {
          const img = imagens[i]
          return {
            base64: img?.data || '',
            mimeType: img?.mimeType || 'image/jpeg',
            legenda: f.legenda,
          }
        })
        .filter((f) => f.base64)

      docxBufferGerado = await gerarLaudoDocx({
        interessado: nome,
        endereco: `${endereco} - ${cidade}, SP`,
        assunto: descricao_cliente,
        numero: numeroFormatado,
        dataDoc: dataCabecalhoPontos,
        laudoTexto,
        emissor: 'Frederico de Miranda Viana',
        fotos: fotosDocx,
      })

      const nomeArquivoDocx = `laudo-${solicitacao_id}.docx`
      const { error: erroUploadDocx } = await supabaseAdmin.storage
        .from('laudos')
        .upload(nomeArquivoDocx, docxBufferGerado, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        })

      if (!erroUploadDocx) {
        const { data: publicUrlDataDocx } = supabaseAdmin.storage
          .from('laudos')
          .getPublicUrl(nomeArquivoDocx)
        docxUrl = publicUrlDataDocx.publicUrl
      } else {
        console.error('Erro ao subir DOCX:', erroUploadDocx)
      }
    } catch (erroDocx) {
      console.error('Erro ao gerar DOCX:', erroDocx instanceof Error ? erroDocx.stack : erroDocx)
    }

    if (solicitacao_id) {
      const { error: erroLaudo } = await supabaseAdmin.from('pre_laudos').insert([
        {
          solicitacao_id,
          conteudo_gerado: laudoTexto,
          nivel_risco: nivelRisco,
          recomendacao,
          pdf_url: pdfUrl,
          docx_url: docxUrl,
        },
      ])

      if (erroLaudo) console.error('Erro ao gravar pré-laudo:', erroLaudo)

      await supabaseAdmin
        .from('solicitacoes')
        .update({ status: 'pre_laudo_gerado' })
        .eq('id', solicitacao_id)
    }

    // Envia e-mail com PDF + DOCX anexados, sem bloquear a resposta ao usuário
    enviarEmailNotificacao({
      nome, email, telefone, cidade, endereco,
      localizacao_arvore, motivo,
      descricao_cliente, sinaisRiscoTexto, observacoes,
      nivelRisco, recomendacao, laudoTexto,
      pdfBuffer: pdfBufferGerado,
      docxBuffer: docxBufferGerado,
    })

    // Retorna o laudo já pronto para aparecer na tela
    return NextResponse.json({
      ok: true,
      message: 'Laudo gerado com sucesso.',
      laudo: laudoTexto,
      nivel_risco: nivelRisco,
      recomendacao: recomendacao,
      pdf_url: pdfUrl,
      docx_url: docxUrl,
    })
  } catch (error) {
    console.error('Erro ao gerar laudo:', error)

    if (body?.solicitacao_id) {
      await supabaseAdmin
        .from('solicitacoes')
        .update({ status: 'erro_laudo' })
        .eq('id', body.solicitacao_id)
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
