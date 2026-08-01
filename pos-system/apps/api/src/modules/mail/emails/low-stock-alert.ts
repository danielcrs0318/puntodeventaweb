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
  warning: '#F59E0B',
  danger: '#EF4444',
}

export interface LowStockAlertEmailProps {
  businessName?: string
  productName: string
  sku?: string
  branchName: string
  quantity: number
  minStockAlert: number
  status: 'BAJO' | 'AGOTADO'
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
  badge: {
    display: 'inline-block',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    marginBottom: '16px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${brand.border}`,
    padding: '10px 0',
  },
  label: { color: brand.muted, fontSize: '14px', margin: 0 },
  value: { color: brand.text, fontSize: '14px', fontWeight: 600, margin: 0 },
  footer: {
    color: brand.muted,
    fontSize: '12px',
    textAlign: 'center',
    marginTop: '24px',
  },
}

export function LowStockAlertEmail({
  businessName = 'POS Honduras',
  productName,
  sku,
  branchName,
  quantity,
  minStockAlert,
  status,
}: LowStockAlertEmailProps) {
  const isOut = status === 'AGOTADO'
  const accent = isOut ? brand.danger : brand.warning
  const statusLabel = isOut ? 'AGOTADO' : 'STOCK BAJO'
  const preview = isOut
    ? `${productName} se agotó en ${branchName}`
    : `${productName} tiene stock bajo en ${branchName}`

  return React.createElement(
    Html,
    null,
    React.createElement(Head, null),
    React.createElement(Preview, null, preview),
    React.createElement(
      Body,
      { style: styles.body },
      React.createElement(
        Container,
        { style: styles.container },
        React.createElement(
          Section,
          { style: styles.header },
          React.createElement(Heading, { style: styles.brand }, businessName),
          React.createElement(Text, { style: styles.tagline }, 'Alerta de inventario'),
        ),
        React.createElement(
          Section,
          { style: styles.card },
          React.createElement(
            Text,
            {
              style: {
                ...styles.badge,
                backgroundColor: `${accent}22`,
                color: accent,
                border: `1px solid ${accent}55`,
              },
            },
            statusLabel,
          ),
          React.createElement(
            Heading,
            { style: styles.heading },
            isOut ? 'Producto agotado' : 'Stock por debajo del mínimo',
          ),
          React.createElement(
            Text,
            { style: styles.paragraph },
            isOut
              ? 'Un producto llegó a cero unidades. Revisa el inventario para reponerlo.'
              : 'Un producto cruzó el umbral mínimo de alerta. Considera reponer stock pronto.',
          ),
          React.createElement(Hr, {
            style: { borderColor: brand.border, margin: '16px 0' },
          }),
          React.createElement(
            Section,
            null,
            detailRow('Producto', productName),
            sku ? detailRow('SKU', sku) : null,
            detailRow('Sucursal', branchName),
            detailRow('Cantidad actual', formatQty(quantity)),
            detailRow('Mínimo de alerta', formatQty(minStockAlert)),
          ),
        ),
        React.createElement(
          Text,
          { style: styles.footer },
          `Notificación automática de ${businessName}.`,
        ),
      ),
    ),
  )
}

function detailRow(label: string, value: string) {
  return React.createElement(
    Section,
    { style: styles.row },
    React.createElement(Text, { style: styles.label }, label),
    React.createElement(Text, { style: styles.value }, value),
  )
}

function formatQty(n: number) {
  return String(Number(n)).replace(/\.?0+$/, '') || '0'
}

export default LowStockAlertEmail
