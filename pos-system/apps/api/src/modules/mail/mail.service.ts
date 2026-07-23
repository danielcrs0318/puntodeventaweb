import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly resend: Resend | null = null
  private readonly from: string
  private readonly enabled: boolean

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim()
    this.from = this.config.get<string>(
      'RESEND_FROM',
      'POS Honduras <onboarding@resend.dev>',
    )
    this.enabled = Boolean(apiKey)

    if (this.enabled && apiKey) {
      this.resend = new Resend(apiKey)
      this.logger.log(`Resend configurado (from: ${this.from})`)
    } else {
      this.logger.warn(
        'RESEND_API_KEY no configurada. Los correos se registrarán en consola.',
      )
    }
  }

  isConfigured(): boolean {
    return this.enabled
  }

  async sendMail(options: {
    to: string
    subject: string
    html: string
    text?: string
    attachments?: { filename: string; content: Buffer; contentType?: string }[]
  }): Promise<{ sent: boolean; preview?: string }> {
    if (!options.to?.trim()) {
      throw new Error('Destinatario de correo vacío')
    }

    if (!this.resend) {
      this.logger.log(
        `[mail-dev] to=${options.to} subject=${options.subject}\n${options.text || options.html}`,
      )
      return { sent: false, preview: 'Correo simulado (Resend no configurado)' }
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    })

    if (error) {
      this.logger.error(`Resend error: ${error.message}`)
      throw new Error(error.message)
    }

    this.logger.log(`Correo enviado a ${options.to}: ${options.subject}`)
    return { sent: true }
  }

  async sendPasswordReset(to: string, userName: string, resetUrl: string) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1220">
        <h2 style="color:#2563EB">Recuperación de contraseña</h2>
        <p>Hola ${userName},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña del sistema POS.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}" style="background:#2563EB;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
            Restablecer contraseña
          </a>
        </p>
        <p>Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje.</p>
        <p style="color:#64748b;font-size:12px">Si el botón no funciona, copia y pega esta URL:<br/>${resetUrl}</p>
      </div>
    `
    return this.sendMail({
      to,
      subject: 'Recuperación de contraseña — POS',
      html,
      text: `Hola ${userName}. Restablece tu contraseña en: ${resetUrl}`,
    })
  }

  async sendSaleReceipt(options: {
    to: string
    customerName: string
    businessName: string
    invoiceNumber: string
    total: string
    pdfBuffer: Buffer
  }) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1220">
        <h2 style="color:#2563EB">${options.businessName}</h2>
        <p>Hola ${options.customerName},</p>
        <p>Adjuntamos el comprobante de tu compra.</p>
        <ul>
          <li><strong>Factura/Recibo:</strong> ${options.invoiceNumber}</li>
          <li><strong>Total:</strong> ${options.total}</li>
        </ul>
        <p>Gracias por su preferencia.</p>
      </div>
    `
    return this.sendMail({
      to: options.to,
      subject: `Comprobante ${options.invoiceNumber} — ${options.businessName}`,
      html,
      text: `Comprobante ${options.invoiceNumber}. Total: ${options.total}`,
      attachments: [
        {
          filename: `${options.invoiceNumber}.pdf`,
          content: options.pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })
  }
}
