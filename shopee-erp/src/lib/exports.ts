import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── EXCEL EXPORT ─────────────────────────────────────────────────────────────
export function exportToExcel(data: Record<string, unknown>[], filename: string, sheetName = 'Dados') {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportMultiSheetExcel(sheets: { name: string; data: Record<string, unknown>[] }[], filename: string) {
  const wb = XLSX.utils.book_new()
  sheets.forEach(({ name, data }) => {
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, name)
  })
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
export function exportToPDF(
  title: string,
  columns: { header: string; dataKey: string }[],
  data: Record<string, unknown>[],
  filename: string
) {
  const doc = new jsPDF({ orientation: 'landscape' })

  // Header
  doc.setFillColor(238, 44, 0)
  doc.rect(0, 0, doc.internal.pageSize.width, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('SHOPEE ERP MASTER', 14, 10)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 16)

  // Date
  doc.setTextColor(255, 255, 255)
  const dateStr = new Date().toLocaleDateString('pt-BR')
  doc.text(`Gerado em: ${dateStr}`, doc.internal.pageSize.width - 60, 13)

  // Table
  autoTable(doc, {
    startY: 25,
    head: [columns.map(c => c.header)],
    body: data.map(row => columns.map(c => String(row[c.dataKey] ?? ''))),
    headStyles: {
      fillColor: [238, 44, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [255, 244, 240] },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
    margin: { top: 25 },
  })

  doc.save(`${filename}.pdf`)
}

// ─── CSV IMPORT PARSER ────────────────────────────────────────────────────────
export function parseShopeeReport(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) return reject(new Error('Arquivo vazio'))

        if (file.name.endsWith('.csv')) {
          // CSV parsing
          import('papaparse').then(({ default: Papa }) => {
            const result = Papa.parse(data as string, { header: true, skipEmptyLines: true })
            resolve(result.data as Record<string, string>[])
          })
        } else {
          // Excel parsing
          const workbook = XLSX.read(data, { type: 'binary' })
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, string>[]
          resolve(jsonData)
        }
      } catch (err) {
        reject(err)
      }
    }
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8')
    } else {
      reader.readAsBinaryString(file)
    }
  })
}
