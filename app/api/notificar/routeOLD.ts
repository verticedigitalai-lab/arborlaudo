import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    await resend.emails.send({
      from: 'Notificações <onboarding@resend.dev>', // pode trocar depois por domínio próprio
      to: 'verticedigital.ai@gmail.com',  

      subject: 'Nova solicitação de laudo arbóreo',
      html: `
        <h2>Nova solicitação recebida</h2>
        <p><strong>Nome:</strong> ${body.nome}</p>
        <p><strong>E-mail:</strong> ${body.email}</p>
        <p><strong>Telefone:</strong> ${body.telefone}</p>
        <p><strong>Endereço:</strong> ${body.endereco}</p>
        <p><strong>Motivo:</strong> ${body.motivo}</p>
        <p><strong>Observações:</strong> ${body.observacoes || '-'}</p>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
