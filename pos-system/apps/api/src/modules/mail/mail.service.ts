import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import * as React from 'react'
import { PasswordResetEmail } from './emails/password-reset'
import {
  SaleReceiptEmail,
  type SaleReceiptEmailProps,
} from './emails/sale-receipt'
import { UserCreatePinEmail } from './emails/user-create-pin'
import {
  LowStockAlertEmail,
  type LowStockAlertEmailProps,
} from './emails/low-stock-alert'

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

  async sendPasswordReset(
    to: string,
    userName: string,
    resetUrl: string,
    businessName = 'POS Honduras',
  ) {
    const html = await render(
      React.createElement(PasswordResetEmail, {
        userName,
        resetUrl,
        businessName,
        expiresInHours: 1,
      }),
    )
    return this.sendMail({
      to,
      subject: `Recuperación de contraseña — ${businessName}`,
      html,
      text: `Hola ${userName}. Restablece tu contraseña de ${businessName} en: ${resetUrl} (válido 1 hora).`,
    })
  }

  async sendUserCreatePin(options: {
    to: string
    userName: string
    userEmail: string
    pin: string
    businessName?: string
    adminName?: string
    expiresMinutes?: number
  }) {
    const businessName = options.businessName ?? 'POS Honduras'
    const expiresMinutes = options.expiresMinutes ?? 15
    const html = await render(
      React.createElement(UserCreatePinEmail, {
        adminName: options.adminName,
        userName: options.userName,
        userEmail: options.userEmail,
        pin: options.pin,
        businessName,
        expiresMinutes,
      }),
    )
    return this.sendMail({
      to: options.to,
      subject: `PIN para crear usuario — ${businessName}`,
      html,
      text: `PIN ${options.pin} para crear el usuario ${options.userName} (${options.userEmail}). Válido ${expiresMinutes} minutos.`,
    })
  }

  async sendLowStockAlert(
    options: LowStockAlertEmailProps & { to: string | string[] },
  ) {
    const businessName = options.businessName ?? 'POS Honduras'
    const recipients = Array.isArray(options.to) ? options.to : [options.to]
    const unique = [...new Set(recipients.map((e) => e.trim().toLowerCase()).filter(Boolean))]
    if (!unique.length) {
      this.logger.warn('sendLowStockAlert: sin destinatarios')
      return { sent: false }
    }

    const html = await render(
      React.createElement(LowStockAlertEmail, {
        businessName,
        productName: options.productName,
        sku: options.sku,
        branchName: options.branchName,
        quantity: options.quantity,
        minStockAlert: options.minStockAlert,
        status: options.status,
      }),
    )

    const subject =
      options.status === 'AGOTADO'
        ? `Agotado: ${options.productName} — ${businessName}`
        : `Stock bajo: ${options.productName} — ${businessName}`

    const text = [
      `${businessName} — alerta de inventario`,
      `Estado: ${options.status}`,
      `Producto: ${options.productName}${options.sku ? ` (${options.sku})` : ''}`,
      `Sucursal: ${options.branchName}`,
      `Cantidad: ${options.quantity}`,
      `Mínimo: ${options.minStockAlert}`,
    ].join('\n')

    let anySent = false
    for (const to of unique) {
      const result = await this.sendMail({ to, subject, html, text })
      if (result.sent) anySent = true
    }
    return { sent: anySent }
  }

  async sendSaleReceipt(
    options: SaleReceiptEmailProps & {
      to: string
      pdfBuffer: Buffer
    },
  ) {
    const {
      to,
      pdfBuffer,
      businessName,
      invoiceNumber,
      total,
      customerName,
      ...emailProps
    } = options

    const html = await render(
      React.createElement(SaleReceiptEmail, {
        businessName,
        invoiceNumber,
        total,
        customerName,
        ...emailProps,
      }),
    )

    const itemsSummary = emailProps.items
      .map((i) => `- ${i.quantity} x ${i.name}: ${i.subtotal}`)
      .join('\n')

    return this.sendMail({
      to,
      subject: `Comprobante ${invoiceNumber} — ${businessName}`,
      html,
      text: [
        `${businessName}`,
        `Hola ${customerName},`,
        `Comprobante: ${invoiceNumber}`,
        `Fecha: ${emailProps.saleDate}`,
        `Total: ${total}`,
        '',
        'Productos:',
        itemsSummary,
        '',
        'El PDF del comprobante va adjunto.',
      ].join('\n'),
      attachments: [
        {
          filename: `${invoiceNumber.replace(/[^\w.-]+/g, '_')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })
  }
}
