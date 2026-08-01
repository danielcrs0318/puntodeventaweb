import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

/** createElement laxo: React 19 + @react-email exige children tipado en props */
function h(
  type: React.ElementType,
  props: Record<string, unknown> | null,
  ...children: React.ReactNode[]
): React.ReactElement {
  return React.createElement(type as React.ComponentType, props, ...children)
}

const brand = {
  bg: '#0B1220',
  card: '#111827',
  border: '#1F2937',
  text: '#F8FAFC',
  muted: '#94A3B8',
  accent: '#3B82F6',
  success: '#22C55E',
}

export interface SaleReceiptItem {
  name: string
  quantity: number
  unitPrice: string
  subtotal: string
}

export interface SaleReceiptPayment {
  method: string
  amount: string
}

export interface SaleReceiptEmailProps {
  businessName: string
  businessAddress?: string | null
  businessPhone?: string | null
  customerName: string
  invoiceNumber: string
  saleDate: string
  cashierName?: string
  branchName?: string
  items: SaleReceiptItem[]
  subtotal: string
  tax: string
  discount?: string
  total: string
  payments: SaleReceiptPayment[]
  notes?: string | null
  currencySymbol?: string
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: brand.bg,
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
    margin: 0,
    padding: '32px 12px',
  },
  container: { maxWidth: '600px', margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: '20px' },
  brand: { color: brand.text, fontSize: '22px', fontWeight: 700, margin: '0 0 4px' },
  meta: { color: brand.muted, fontSize: '12px', margin: '2px 0' },
  card: {
    backgroundColor: brand.card,
    border: `1px solid ${brand.border}`,
    borderRadius: '12px',
    padding: '28px 22px',
  },
  heading: { color: brand.text, fontSize: '20px', fontWeight: 600, margin: '0 0 12px' },
  paragraph: { color: brand.muted, fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px' },
  infoBox: {
    backgroundColor: '#0B1220',
    borderRadius: '8px',
    padding: '14px 16px',
    marginBottom: '20px',
    border: `1px solid ${brand.border}`,
  },
  label: {
    color: brand.muted,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    margin: '0 0 4px',
  },
  value: { color: brand.text, fontSize: '14px', fontWeight: 600, margin: 0 },
  sectionTitle: {
    color: brand.text,
    fontSize: '13px',
    fontWeight: 600,
    margin: '8px 0 10px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  tableHead: {
    borderBottom: `1px solid ${brand.border}`,
    paddingBottom: '6px',
    marginBottom: '4px',
  },
  th: {
    color: brand.muted,
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    margin: 0,
  },
  tableRow: { padding: '8px 0' },
  td: { color: brand.text, fontSize: '13px', margin: 0, lineHeight: '1.4' },
  hr: { borderColor: brand.border, margin: '16px 0' },
  summaryLabel: { color: brand.muted, fontSize: '13px', margin: '4px 0' },
  summaryValue: { color: brand.text, fontSize: '13px', margin: '4px 0', textAlign: 'right' },
  totalLabel: { color: brand.text, fontSize: '15px', fontWeight: 700, margin: '10px 0 0' },
  totalValue: {
    color: brand.success,
    fontSize: '18px',
    fontWeight: 700,
    margin: '10px 0 0',
    textAlign: 'right',
  },
  attachNote: {
    marginTop: '20px',
    padding: '12px 14px',
    backgroundColor: '#0B1220',
    borderRadius: '8px',
    border: `1px solid ${brand.border}`,
  },
  muted: { color: brand.muted, fontSize: '12px', lineHeight: '1.5' },
  footer: {
    color: brand.muted,
    fontSize: '11px',
    textAlign: 'center',
    marginTop: '24px',
  },
}

function showDiscount(discount?: string) {
  if (!discount) return false
  return discount !== 'L. 0.00' && !discount.endsWith(' 0.00')
}

export function SaleReceiptEmail({
  businessName,
  businessAddress,
  businessPhone,
  customerName,
  invoiceNumber,
  saleDate,
  cashierName,
  branchName,
  items,
  subtotal,
  tax,
  discount,
  total,
  payments,
  notes,
}: SaleReceiptEmailProps) {
  const headerChildren: React.ReactNode[] = [
    h(Text, { key: 'brand', style: styles.brand }, businessName),
  ]
  if (businessAddress) {
    headerChildren.push(h(Text, { key: 'addr', style: styles.meta }, businessAddress))
  }
  if (businessPhone) {
    headerChildren.push(h(Text, { key: 'phone', style: styles.meta }, `Tel: ${businessPhone}`))
  }

  const itemRows = items.map((item, idx) =>
    h(
      Section,
      {
        key: `${item.name}-${idx}`,
        style: {
          ...styles.tableRow,
          borderBottom: idx === items.length - 1 ? 'none' : `1px solid ${brand.border}`,
        },
      },
      h(
        Row,
        null,
        h(Column, { style: { width: '46%' } }, h(Text, { style: styles.td }, item.name)),
        h(
          Column,
          { style: { width: '14%' } },
          h(Text, { style: { ...styles.td, textAlign: 'center' } }, String(item.quantity)),
        ),
        h(
          Column,
          { style: { width: '20%' } },
          h(Text, { style: { ...styles.td, textAlign: 'right' } }, item.unitPrice),
        ),
        h(
          Column,
          { style: { width: '20%' } },
          h(Text, { style: { ...styles.td, textAlign: 'right' } }, item.subtotal),
        ),
      ),
    ),
  )

  const paymentRows = payments.map((p, i) =>
    h(
      Row,
      { key: `${p.method}-${i}` },
      h(Column, null, h(Text, { style: styles.summaryLabel }, p.method)),
      h(Column, null, h(Text, { style: styles.summaryValue }, p.amount)),
    ),
  )

  const cardChildren: React.ReactNode[] = [
    h(Heading, { key: 'h', style: styles.heading }, 'Comprobante de compra'),
    h(
      Text,
      { key: 'intro', style: styles.paragraph },
      'Hola ',
      h('strong', { style: { color: brand.text } }, customerName),
      ', gracias por tu compra. Adjuntamos el PDF del comprobante y el detalle a continuación.',
    ),
    h(
      Section,
      { key: 'info', style: styles.infoBox },
      h(
        Row,
        null,
        h(
          Column,
          null,
          h(Text, { style: styles.label }, 'Documento'),
          h(Text, { style: styles.value }, invoiceNumber),
        ),
        h(
          Column,
          null,
          h(Text, { style: styles.label }, 'Fecha'),
          h(Text, { style: styles.value }, saleDate),
        ),
      ),
      branchName || cashierName
        ? h(
            Row,
            { style: { marginTop: '12px' } },
            branchName
              ? h(
                  Column,
                  null,
                  h(Text, { style: styles.label }, 'Sucursal'),
                  h(Text, { style: styles.value }, branchName),
                )
              : h(Column, null),
            cashierName
              ? h(
                  Column,
                  null,
                  h(Text, { style: styles.label }, 'Atendido por'),
                  h(Text, { style: styles.value }, cashierName),
                )
              : h(Column, null),
          )
        : null,
    ),
    h(Text, { key: 'st', style: styles.sectionTitle }, 'Detalle de productos'),
    h(
      Section,
      { key: 'thead', style: styles.tableHead },
      h(
        Row,
        null,
        h(Column, { style: { width: '46%' } }, h(Text, { style: styles.th }, 'Producto')),
        h(Column, { style: { width: '14%' } }, h(Text, { style: { ...styles.th, textAlign: 'center' } }, 'Cant.')),
        h(Column, { style: { width: '20%' } }, h(Text, { style: { ...styles.th, textAlign: 'right' } }, 'P. unit.')),
        h(Column, { style: { width: '20%' } }, h(Text, { style: { ...styles.th, textAlign: 'right' } }, 'Subtotal')),
      ),
    ),
    ...itemRows,
    h(Hr, { key: 'hr1', style: styles.hr }),
    h(
      Section,
      { key: 'totals' },
      h(
        Row,
        null,
        h(Column, null, h(Text, { style: styles.summaryLabel }, 'Subtotal')),
        h(Column, null, h(Text, { style: styles.summaryValue }, subtotal)),
      ),
      h(
        Row,
        null,
        h(Column, null, h(Text, { style: styles.summaryLabel }, 'ISV / Impuesto')),
        h(Column, null, h(Text, { style: styles.summaryValue }, tax)),
      ),
      showDiscount(discount)
        ? h(
            Row,
            null,
            h(Column, null, h(Text, { style: styles.summaryLabel }, 'Descuento')),
            h(Column, null, h(Text, { style: styles.summaryValue }, `-${discount}`)),
          )
        : null,
      h(
        Row,
        null,
        h(Column, null, h(Text, { style: styles.totalLabel }, 'Total')),
        h(Column, null, h(Text, { style: styles.totalValue }, total)),
      ),
    ),
  ]

  if (payments.length > 0) {
    cardChildren.push(
      h(Text, { key: 'pay-t', style: styles.sectionTitle }, 'Forma de pago'),
      ...paymentRows,
    )
  }

  if (notes) {
    cardChildren.push(
      h(Hr, { key: 'hr2', style: styles.hr }),
      h(Text, { key: 'nl', style: styles.label }, 'Notas'),
      h(Text, { key: 'nv', style: styles.paragraph }, notes),
    )
  }

  cardChildren.push(
    h(
      Section,
      { key: 'attach', style: styles.attachNote },
      h(Text, { style: { ...styles.muted, margin: 0 } }, '📎 El PDF del comprobante va adjunto a este correo.'),
    ),
  )

  return h(
    Html,
    { lang: 'es' },
    h(Head, null),
    h(Preview, null, `Comprobante ${invoiceNumber} — Total ${total}`),
    h(
      Body,
      { style: styles.body },
      h(
        Container,
        { style: styles.container },
        h(Section, { style: styles.header }, ...headerChildren),
        h(Section, { style: styles.card }, ...cardChildren),
        h(
          Text,
          { style: styles.footer },
          `© ${new Date().getFullYear()} ${businessName}. Gracias por su preferencia.`,
        ),
      ),
    ),
  )
}

export default SaleReceiptEmail
