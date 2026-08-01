import {
  Body,
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

export interface UserCreatePinEmailProps {
  adminName?: string
  userName: string
  userEmail: string
  pin: string
  businessName?: string
  expiresMinutes?: number
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
  pinBox: {
    backgroundColor: '#0B1220',
    border: `1px solid ${brand.border}`,
    borderRadius: '10px',
    padding: '20px',
    textAlign: 'center',
    margin: '24px 0',
  },
  pin: {
    color: brand.accent,
    fontSize: '32px',
    fontWeight: 700,
    letterSpacing: '0.35em',
    margin: 0,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  muted: { color: brand.muted, fontSize: '12px', margin: 0, lineHeight: '1.5' },
  hr: { borderColor: brand.border, margin: '24px 0' },
  footer: {
    color: brand.muted,
    fontSize: '11px',
    textAlign: 'center',
    marginTop: '24px',
  },
}

export function UserCreatePinEmail({
  adminName,
  userName,
  userEmail,
  pin,
  businessName = 'POS Honduras',
  expiresMinutes = 15,
}: UserCreatePinEmailProps) {
  return React.createElement(
    Html,
    { lang: 'es' },
    React.createElement(Head),
    React.createElement(Preview, null, `PIN ${pin} para crear usuario en ${businessName}`),
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
          React.createElement(Text, { style: styles.tagline }, 'Verificación de nuevo usuario'),
        ),
        React.createElement(
          Section,
          { style: styles.card },
          React.createElement(Heading, { style: styles.heading }, 'PIN de verificación'),
          React.createElement(
            Text,
            { style: styles.paragraph },
            adminName ? `Hola ${adminName}, ` : '',
            'para completar la creación del usuario ',
            React.createElement('strong', { style: { color: brand.text } }, userName),
            ` (${userEmail}) ingresa este PIN en el sistema:`,
          ),
          React.createElement(
            Section,
            { style: styles.pinBox },
            React.createElement(Text, { style: styles.pin }, pin),
          ),
          React.createElement(
            Text,
            { style: styles.muted },
            `El PIN expira en ${expiresMinutes} minutos. Si no solicitaste crear este usuario, ignora este correo.`,
          ),
          React.createElement(Hr, { style: styles.hr }),
          React.createElement(
            Text,
            { style: styles.muted },
            'Por seguridad, no compartas este código. Solo el administrador que está creando la cuenta debe usarlo.',
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

export default UserCreatePinEmail
