// A simple editable table: change a cell and the data updates straight away.

export interface Col<T> {
  key: keyof T & string
  label: string
  kind: 'text' | 'number' | 'select' | 'checkbox' | 'date'
  options?: Array<{ value: string; label: string }>
  min?: number
  max?: number
  step?: number
  readOnly?: boolean
}

interface Props<T> {
  caption: string
  rows: T[]
  cols: Array<Col<T>>
  rowKey: (row: T) => string
  onChange: (row: T, patch: Partial<T>) => void
  onDelete: (row: T) => void
  onAdd: () => void
  addLabel: string
}

export default function EditableTable<T>({ caption, rows, cols, rowKey, onChange, onDelete, onAdd, addLabel }: Props<T>) {
  const input = 'border border-line rounded px-1.5 py-1 w-full bg-white'
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto bg-white border border-line rounded-lg max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="text-left bg-paper sticky top-0">
            <tr>{cols.map((c) => <th key={c.key} scope="col" className="p-2 whitespace-nowrap">{c.label}</th>)}<th scope="col" className="p-2"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = rowKey(row)
              return (
                <tr key={id} className="border-t border-line">
                  {cols.map((c) => {
                    const value = row[c.key] as unknown
                    const label = `${c.label} for ${id}`
                    return (
                      <td key={c.key} className="p-1.5 min-w-24">
                        {c.readOnly ? <span className="px-1.5">{String(value)}</span>
                          : c.kind === 'select' ? (
                            <select aria-label={label} className={input} value={String(value ?? '')} onChange={(e) => onChange(row, { [c.key]: e.target.value } as Partial<T>)}>
                              {c.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          ) : c.kind === 'checkbox' ? (
                            <input aria-label={label} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(row, { [c.key]: e.target.checked } as Partial<T>)} />
                          ) : c.kind === 'number' ? (
                            <input aria-label={label} className={input} type="number" min={c.min} max={c.max} step={c.step ?? 1} value={Number.isFinite(value as number) ? String(value) : ''}
                              onChange={(e) => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) onChange(row, { [c.key]: Math.min(c.max ?? Infinity, Math.max(c.min ?? -Infinity, n)) } as Partial<T>) }} />
                          ) : c.kind === 'date' ? (
                            <input aria-label={label} className={input} type="date" value={String(value ?? '')} onChange={(e) => onChange(row, { [c.key]: e.target.value === '' ? null : e.target.value } as Partial<T>)} />
                          ) : (
                            <input aria-label={label} className={input} type="text" value={String(value ?? '')} onChange={(e) => onChange(row, { [c.key]: e.target.value } as Partial<T>)} />
                          )}
                      </td>
                    )
                  })}
                  <td className="p-1.5"><button type="button" onClick={() => onDelete(row)} aria-label={`Delete ${id}`} className="px-2 py-1 border border-line rounded hover:bg-red-50">Delete</button></td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td className="p-3 text-muted" colSpan={cols.length + 1}>Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={onAdd} className="px-3 py-2 rounded-md bg-accent text-white hover:bg-accent-dark text-sm">{addLabel}</button>
    </div>
  )
}
