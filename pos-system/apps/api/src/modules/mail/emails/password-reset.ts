import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

const brand = {
  bg: '#0B1220',
  card: '#111827',
  border: '#1F2937',
  text: '#F8FAFC',
  muted: '#94A3B8',
  accent: '#3B82F6',
}

export interface PasswordResetEmailProps {
  userName: string
  resetUrl: string
  businessName?: string
  expiresInHours?: number
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: brand.bg,
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
    margin: 0,
    padding: '32px 12px',
  },
  container: { maxWidth: '560px', margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: '24px' },
  brand: {
    color: brand.text,
    fontSize: '22px',
    fontWeight: 700,
    margin: '0 0 4px',
    letterSpacing: '-0.02em',
  },
  tagline: { color: brand.muted, fontSize: '13px', margin: 0 },
  card: {
    backgroundColor: brand.card,
    border: `1px solid ${brand.border}`,
    borderRadius: '12px',
    padding: '28px 24px',
  },
  heading: {
    color: brand.text,
    fontSize: '20px',
    fontWeight: 600,
    margin: '0 0 16px',
  },
  paragraph: {
    color: brand.muted,
    fontSize: '15px',
    lineHeight: '1.6',
    margin: '0 0 12px',
  },
  ctaWrap: { textAlign: 'center', margin: '28px 0' },
  button: {
    backgroundColor: brand.accent,
    borderRadius: '8px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
    padding: '14px 28px',
    textDecoration: 'none',
  },
  muted: { color: brand.muted, fontSize: '12px', margin: '0 0 8px', lineHeight: '1.5' },
  linkBreak: {
    color: brand.accent,
    fontSize: '12px',
    wordBreak: 'break-all',
    margin: '0 0 8px',
    lineHeight: '1.5',
  },
  hr: { borderColor: brand.border, margin: '24px 0' },
  footerNote: { color: brand.muted, fontSize: '12px', margin: 0, lineHeight: '1.5' },
  footer: {
    color: brand.muted,
    fontSize: '11px',
    textAlign: 'center',
    marginTop: '24px',
  },
}

export function PasswordResetEmail({
  userName,
  resetUrl,
  businessName = 'POS Honduras',
  expiresInHours = 1,
}: PasswordResetEmailProps) {
  const hoursLabel = expiresInHours === 1 ? '1 hora' : `${expiresInHours} horas`

  return React.createElement(
    Html,
    { lang: 'es' },
    React.createElement(Head),
    React.createElement(Preview, null, `Restablece tu contraseña de ${businessName}`),
    React.createElement(
      Body,
      { style: styles.body },
      React.createElement(
        Container,
        { style: styles.container },
        React.createElement(
          Section,
          { style: styles.header },
          React.createElement(Text, { style: styles.brand }, businessName),
          React.createElement(Text, { style: styles.tagline }, 'Sistema de Punto de Venta'),
        ),
        React.createElement(
          Section,
          { style: styles.card },
          React.createElement(Heading, { style: styles.heading }, 'Recuperación de contraseña'),
          React.createElement(
            Text,
            { style: styles.paragraph },
            'Hola ',
            React.createElement('strong', null, userName),
            ',',
          ),
          React.createElement(
            Text,
            { style: styles.paragraph },
            `Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${businessName}. `,
            'Si fuiste tú, usa el botón de abajo. El enlace es válido por ',
            React.createElement('strong', null, hoursLabel),
            '.',
          ),
          React.createElement(
            Section,
            { style: styles.ctaWrap },
            React.createElement(Button, { href: resetUrl, style: styles.button }, 'Restablecer contraseña'),
          ),
          React.createElement(
            Text,
            { style: styles.muted },
            'Si el botón no funciona, copia y pega esta URL en tu navegador:',
          ),
          React.createElement(Text, { style: styles.linkBreak }, resetUrl),
          React.createElement(Hr, { style: styles.hr }),
          React.createElement(
            Text,
            { style: styles.footerNote },
            'Si no solicitaste este cambio, ignora este mensaje. Tu contraseña actual no se modificará.',
          ),
        ),
        React.createElement(
          Text,
          { style: styles.footer },
          `© ${new Date().getFullYear()} ${businessName}. Correo automático — no responder.`,
        ),
      ),
    ),
  )
}

export default PasswordResetEmail
