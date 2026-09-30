import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  HeadingLevel,
  WidthType,
} from 'docx'

type FotoDocx = { base64: string; mimeType: string; legenda: string }

type Props = {
  interessado: string
  endereco: string
  assunto: string
  numero: string
  dataDoc: string
  laudoTexto: string
  emissor: string
  fotos: FotoDocx[]
}

export async function gerarLaudoDocx({
  interessado,
  endereco,
  assunto,
  numero,
  dataDoc,
  laudoTexto,
  emissor,
  fotos,
}: Props): Promise<Buffer> {
  // Remove marcações de parse e separadores visuais
  const textoLimpo = laudoTexto
    .replace(/LEGENDA_FOTO_\d+:.*$/gim, '')
    .replace(/NIVEL_RISCO:.*$/gim, '')
    .replace(/RECOMENDACAO:.*$/gim, '')
    .replace(/^[═=─\-_]{5,}$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const paragrafosTexto = textoLimpo
    .split('\n')
    .map((linha) => new Paragraph({ children: [new TextRun(linha)], spacing: { after: 100 } }))

  // Todas as fotos já chegam convertidas para JPEG real (via sharp, no route.ts)
  const imagensDocx = fotos.flatMap((foto, i) => {
    try {
      const buffer = Buffer.from(foto.base64, 'base64')
      return [
        new Paragraph({
          children: [
            new ImageRun({
              data: buffer,
              transformation: { width: 500, height: 350 },
              type: 'jpg',
            }),
          ],
        }),
        new Paragraph({ text: `Figura ${i + 1}: ${foto.legenda}`, spacing: { after: 300 } }),
      ]
    } catch (err) {
      console.error(`Erro ao processar imagem ${i + 1} no DOCX:`, err)
      return []
    }
  })

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'LAUDO TÉCNICO DE AVALIAÇÃO ARBÓREA',
            heading: HeadingLevel.HEADING_1,
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(`Interessado: ${interessado}`)] }),
                  new TableCell({ children: [new Paragraph(`Nº: ${numero}`)] }),
                  new TableCell({ children: [new Paragraph(`Data: ${dataDoc}`)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph(`Endereço: ${endereco}`)],
                    columnSpan: 3,
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph(`Assunto: ${assunto}`)],
                    columnSpan: 3,
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { after: 200 } }),
          ...paragrafosTexto,
          ...imagensDocx,
          new Paragraph({ text: '', spacing: { before: 400 } }),
          new Paragraph({ text: emissor, bold: true }),
          new Paragraph({ text: 'Biólogo CRBio 50740/01-S' }),
        ],
      },
    ],
  })

  return await Packer.toBuffer(doc)
}
