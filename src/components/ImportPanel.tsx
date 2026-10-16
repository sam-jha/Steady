import { useMemo, useState } from 'react'
import { useApp } from '../data/AppContext'
import { applyImport, integrityIssues, KINDS, kindInfo, parseCsv, parseJsonBackup, parseXlsx, templateCsv, templateXlsx, validate, type DataKind, type ImportMode, type ParsedSheet } from '../data/importExport'
import { cleanUp } from '../data/importExport'
import { downloadFile, MIME } from './download'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_SHOWN = 40

export default function ImportPanel() {
  const { data, updateData } = useApp()
  const [kind, setKind] = useState<DataKind>('teams')
  const [mode, setMode] = useState<ImportMode>('replace')
  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [fileName, setFileName] = useState('')
  const [readError, setReadError] = useState('')
  const [done, setDone] = useState('')

  const info = kindInfo(kind)
  const result = useMemo(() => (sheet ? validate(kind, sheet, data) : null), [sheet, kind, data])
  const preview = useMemo(() => (result && result.errors.length === 0 ? applyImport(data, kind, result.items, mode) : null), [result, data, kind, mode])
  const integrity = preview ? integrityIssues(preview) : []

  const onFile = async (file: File | undefined) => {
    setSheet(null); setReadError(''); setDone(''); setFileName(file?.name ?? '')
    if (!file) return
    if (file.size > MAX_BYTES) { setReadError('That file is larger than 5 MB. Steady is built for small spreadsheets: please split it up.'); return }
    try {
      if (/\.xlsx?$/i.test(file.name)) setSheet(parseXlsx(await file.arrayBuffer(), kind))
      else if (/\.(csv|txt)$/i.test(file.name)) setSheet(parseCsv(await file.text()))
      else setReadError('Please choose a .csv or .xlsx file.')
    } catch {
      setReadError('Steady could not read that file. Check that it is a normal CSV or Excel file and not password protected.')
    }
  }

  const commit = () => {
    if (!result || !preview) return
    updateData(() => preview)
    setDone(`Imported ${result.items.length} ${info.label.toLowerCase()} row${result.items.length === 1 ? '' : 's'} (${mode === 'replace' ? 'replacing the existing list' : 'merged with the existing list'}).`)
    setSheet(null); setFileName('')
  }

  const restoreJson = async (file: File | undefined) => {
    if (!file) return
    const { data: restored, error } = parseJsonBackup(await file.text())
    if (error || !restored) { setReadError(error ?? 'Could not read that file.'); return }
    if (window.confirm('Replace ALL current data with the contents of this file?')) { updateData(() => cleanUp(restored)); setDone('Restored everything from the JSON file.') }
  }

  const btn = 'px-3 py-2 rounded-md border border-line bg-white hover:bg-accent-soft text-sm'
  return (
    <div className="space-y-6">
      <div className="bg-white border border-line rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">1. Pick what you are importing</h3>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type of data">
          {KINDS.map((k) => (
            <label key={k.kind} className={`px-3 py-2 rounded-md border cursor-pointer text-sm ${kind === k.kind ? 'border-accent bg-accent-soft font-medium' : 'border-line'}`}>
              <input type="radio" className="sr-only" name="kind" checked={kind === k.kind} onChange={() => { setKind(k.kind); setSheet(null); setFileName(''); setDone('') }} />{k.label}
            </label>
          ))}
        </div>
        <p className="text-sm text-muted max-w-prose">{info.help}</p>
        <p className="text-sm text-muted">Import in this order if you are starting from scratch: Teams, People, Tasks, Skills matrix, Absences.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => downloadFile(`steady-template-${kind}.csv`, templateCsv(kind), MIME.csv)}>Download CSV template</button>
          <button type="button" className={btn} onClick={() => downloadFile(`steady-template-${kind}.xlsx`, templateXlsx(kind), MIME.xlsx)}>Download Excel template</button>
        </div>
      </div>

      <div className="bg-white border border-line rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">2. Upload your file</h3>
        <label className="block text-sm">CSV or Excel file (.csv, .xlsx). The first row must be the column names.
          <input type="file" accept=".csv,.xlsx,.xls,text/csv" className="block mt-1" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <fieldset className="text-sm">
          <legend>What should happen to the data you already have?</legend>
          <label className="flex items-center gap-2 mt-1"><input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace all existing {info.label.toLowerCase()} with the file</label>
          <label className="flex items-center gap-2"><input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Add to existing; rows with a matching id update that record</label>
        </fieldset>
        <p className="text-xs text-muted">Files are read in your browser. Nothing is uploaded anywhere.</p>
        {readError && <p role="alert" className="text-red-900 font-medium">⚠ {readError}</p>}
      </div>

      {done && <p role="status" className="rounded-md border border-green-300 bg-green-100 text-green-900 p-3">✓ {done}</p>}

      {result && (
        <div className="bg-white border border-line rounded-lg p-4 space-y-3" aria-live="polite">
          <h3 className="font-semibold">3. Check before importing: {fileName}</h3>
          {result.errors.length > 0 ? (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-950">
              <p className="font-medium">⚠ {result.errors.length} problem{result.errors.length === 1 ? '' : 's'} to fix. Nothing has been imported. Fix the file and upload it again.</p>
              <ul className="list-disc pl-5 text-sm mt-1 space-y-0.5">{result.errors.slice(0, MAX_SHOWN).map((e, i) => <li key={i}>{e.message}</li>)}</ul>
              {result.errors.length > MAX_SHOWN && <p className="text-sm mt-1">…and {result.errors.length - MAX_SHOWN} more.</p>}
            </div>
          ) : (
            <p className="rounded-md border border-green-300 bg-green-100 text-green-900 p-3">✓ All {result.items.length} row{result.items.length === 1 ? '' : 's'} look good.</p>
          )}
          {[...result.warnings.map((w) => w.message), ...integrity].length > 0 && (
            <div className="rounded-md border border-amber-400 bg-amber-100 text-amber-950 p-3 text-sm">
              <p className="font-medium">▲ Worth a look (these do not block the import):</p>
              <ul className="list-disc pl-5">{[...result.warnings.map((w) => w.message), ...integrity].slice(0, MAX_SHOWN).map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          {result.errors.length === 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="text-sm">
                  <caption className="text-left text-muted mb-1">First {Math.min(8, result.items.length)} rows as Steady understood them</caption>
                  <thead className="text-left bg-paper"><tr>{info.columns.map((c) => <th key={c} scope="col" className="p-1.5">{c}</th>)}</tr></thead>
                  <tbody>
                    {sheet!.rows.slice(0, 8).map((r, i) => <tr key={i} className="border-t border-line">{info.columns.map((c) => <td key={c} className="p-1.5">{r[c]}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted">
                {mode === 'replace' ? `This will replace the ${(data[kind] as unknown[]).length} existing ${info.label.toLowerCase()} with ${result.items.length}.` : `This will add or update ${result.items.length} ${info.label.toLowerCase()}.`}
                {(kind === 'people' || kind === 'tasks') && mode === 'replace' ? ' Skills and absences that point at anyone or anything no longer listed are removed.' : ''}
              </p>
              <button type="button" onClick={commit} className="px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-dark">Import {result.items.length} row{result.items.length === 1 ? '' : 's'}</button>
            </>
          )}
        </div>
      )}

      <div className="bg-white border border-line rounded-lg p-4 space-y-2">
        <h3 className="font-semibold">Restore from a Steady JSON export</h3>
        <p className="text-sm text-muted">Replaces everything, including saved scenarios and the wellbeing pulse history.</p>
        <input type="file" accept=".json,application/json" onChange={(e) => restoreJson(e.target.files?.[0])} aria-label="Choose a Steady JSON export" />
      </div>
    </div>
  )
}
