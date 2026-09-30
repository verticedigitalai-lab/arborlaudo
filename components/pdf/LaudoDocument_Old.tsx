import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: 'Helvetica' },
  headerTable: { borderWidth: 1, borderColor: '#000', marginBottom: 10 },
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000' },
  headerCell: { padding: 4, borderRightWidth: 1, borderColor: '#000' },
  headerCellLast: { padding: 4 },
  bold: { fontWeight: 700 },
  assunto: { padding: 4, fontWeight: 700, fontSize: 9 },
  photoBox: {
    borderWidth: 1,
    borderColor: '#000',
    flex: 1,
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  photoImg: { width: '100%', height: 480, objectFit: 'contain' },
  caption: { padding: 6, borderTopWidth: 1, borderColor: '#000', fontSize: 9 },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#000',
    marginTop: 'auto',
  },
  footerCell: { padding: 6, borderRightWidth: 1, borderColor: '#000', flex: 1 },
  footerCellLast: { padding: 6, width: 70 },
  laudoText: { fontSize: 9.5, lineHeight: 1.5, marginBottom: 6 },
  tableRow: { flexDirection: 'row' },
  tableCell: {
    borderWidth: 0.5,
    borderColor: '#000',
    padding: 4,
    flex: 1,
    fontSize: 8,
  },
})

type Props = {
  interessado: string
  empreendimento: string
  endereco: string
  assunto: string
  numero: string
  dataDoc: string
  rev: string
  fotos: { url: string; legenda: string }[]
  laudoTexto: string
  emissor: string
}

type ReactPdfImageSource = {
  // O parser JPEG interno do react-pdf chama readUInt16BE().
  // Portanto, data precisa ser um Buffer, não uma string base64.
  data: Buffer
  format: 'jpg' | 'png'
}

/**
 * Converte uma data URI de imagem em uma fonte compatível com react-pdf.
 *
 * Importante: não retornar { data: base64String }. O parser JPEG usado pelo
 * @react-pdf/renderer espera um Buffer e falha com:
 * "data.readUInt16BE is not a function" quando recebe string.
 */
function parseImageSrc(url: string): ReactPdfImageSource | string {
  const match = url.match(
    /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=\s]+)$/i,
  )

  if (!match) {
    return url
  }

  const [, ext, base64] = match
  const normalizedBase64 = base64.replace(/\s/g, '')
  const data = Buffer.from(normalizedBase64, 'base64')

  if (data.length === 0) {
    throw new Error('A imagem base64 está vazia ou inválida.')
  }

  return {
    data,
    format: ext.toLowerCase() === 'png' ? 'png' : 'jpg',
  }
}

function Cabecalho({
  interessado,
  empreendimento,
  endereco,
  assunto,
  numero,
  dataDoc,
  rev,
}: Omit<Props, 'fotos' | 'laudoTexto' | 'emissor'>) {
  return (
    <View style={styles.headerTable}>
      <View style={styles.headerRow}>
        <View style={[styles.headerCell, { width: 160 }]}>
          <Text style={styles.bold}>Interessado:</Text>
          <Text>{interessado}</Text>
        </View>
        <View style={[styles.headerCell, { flex: 1 }]}>
          <Text style={styles.bold}>{endereco}</Text>
        </View>
        <View style={{ width: 90 }}>
          <View style={[styles.headerCell, { borderBottomWidth: 1 }]}>
            <Text style={styles.bold}>Nº: {numero}</Text>
          </View>
          <View style={styles.headerCellLast}>
            <Text style={styles.bold}>Data: {dataDoc}</Text>
          </View>
        </View>
      </View>
      <View style={styles.headerRow}>
        <View style={[styles.headerCell, { flex: 1 }]}>
          <Text style={styles.bold}>Empreendimento:</Text>
          <Text>{empreendimento}</Text>
        </View>
        <View style={{ width: 90, padding: 4 }}>
          <Text style={styles.bold}>Rev. {rev}</Text>
        </View>
      </View>
      <View style={{ borderTopWidth: 1, borderColor: '#000' }}>
        <Text style={styles.assunto}>ASSUNTO: {assunto}</Text>
      </View>
    </View>
  )
}

function Rodape({ emissor, pagina }: { emissor: string; pagina: number }) {
  return (
    <View style={styles.footer}>
      <View style={styles.footerCell}>
        <Text style={styles.bold}>Emissor:</Text>
        <Text>{emissor}</Text>
      </View>
      <View style={styles.footerCell}>
        <Text style={styles.bold}>Verificador:</Text>
      </View>
      <View style={styles.footerCellLast}>
        <Text style={styles.bold}>Página: {pagina}</Text>
      </View>
    </View>
  )
}

export default function LaudoDocument({
  interessado,
  empreendimento,
  endereco,
  assunto,
  numero,
  dataDoc,
  rev,
  fotos,
  laudoTexto,
  emissor,
}: Props) {
  const headerProps = { interessado, empreendimento, endereco, assunto, numero, dataDoc, rev }

  const textoLimpo = laudoTexto
    .replace(/LEGENDA_FOTO_\d+:.*$/gim, '')
    .replace(/NIVEL_RISCO:.*$/gim, '')
    .replace(/RECOMENDACAO:.*$/gim, '')
    .replace(/^[═=─\-_]{5,}$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const partes = textoLimpo.split(/\n(?=\|)/)
  const corpoTexto = partes[0]
  const tabelaMarkdown = partes.slice(1).join('\n')

  const linhasTabela = tabelaMarkdown
    .split('\n')
    .filter((linha) => linha.trim().startsWith('|'))
    .map((linha) => linha.split('|').map((celula) => celula.trim()).filter((celula) => celula !== ''))
    .filter((colunas) => colunas.length > 0 && !colunas[0].includes(':---'))

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Cabecalho {...headerProps} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.bold, { fontSize: 12, marginBottom: 8 }]}>
            LAUDO TÉCNICO DE AVALIAÇÃO ARBÓREA
          </Text>
          {corpoTexto.split('\n').map((linha, i) => (
            <Text key={i} style={styles.laudoText}>{linha}</Text>
          ))}
        </View>
        <Rodape emissor={emissor} pagina={1} />
      </Page>

      {fotos.map((foto, i) => (
        <Page key={i} size="A4" style={styles.page}>
          <Cabecalho {...headerProps} />
          <View style={styles.photoBox}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={parseImageSrc(foto.url)} style={styles.photoImg} />
            <Text style={styles.caption}>
              Figura {i + 1}: {foto.legenda}
            </Text>
          </View>
          <Rodape emissor={emissor} pagina={i + 2} />
        </Page>
      ))}

      {linhasTabela.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Cabecalho {...headerProps} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bold, { fontSize: 11, marginBottom: 8 }]}>
              TABELA RESUMO
            </Text>
            {linhasTabela.map((colunas, ri) => (
              <View key={ri} style={styles.tableRow}>
                {colunas.map((coluna, ci) => (
                  <Text
                    key={ci}
                    style={[styles.tableCell, ri === 0 ? styles.bold : {}]}
                  >
                    {coluna}
                  </Text>
                ))}
              </View>
            ))}
            <Text style={{ marginTop: 20 }}>
              {dataDoc.split(' de ').length
                ? `${endereco.split(',').pop()?.trim() || ''}, ${dataDoc}.`
                : ''}
            </Text>
            <Text style={styles.bold}>{emissor}</Text>
            <Text>Biólogo CRBio 50740/01-S</Text>
          </View>
          <Rodape emissor={emissor} pagina={fotos.length + 2} />
        </Page>
      )}
    </Document>
  )
}
