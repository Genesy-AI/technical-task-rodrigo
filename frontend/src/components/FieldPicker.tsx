import { FC, useState } from 'react'
import { LeadsGetFieldsOutput } from '../api/types/leads/getFields'

interface FieldPickerProps {
  fields: LeadsGetFieldsOutput
  missingCounts: Record<string, number>
  selectedCount: number
  onInsert: (key: string) => void
}

export const FieldPicker: FC<FieldPickerProps> = ({ fields, missingCounts, selectedCount, onInsert }) => {
  const [query, setQuery] = useState('')
  const search = query.trim().toLowerCase()
  const matches = fields.filter(
    (field) =>
      !search || field.label.toLowerCase().includes(search) || field.key.toLowerCase().includes(search)
  )
  const groups = matches.reduce<Record<string, LeadsGetFieldsOutput>>((acc, field) => {
    ;(acc[field.group] ??= []).push(field)
    return acc
  }, {})

  const insert = (key: string) => {
    onInsert(key)
    setQuery('')
  }

  return (
    <div className="border border-gray-200 rounded-md">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Enter would submit the surrounding form; insert the first match instead
          if (e.key === 'Enter') {
            e.preventDefault()
            if (matches[0]) insert(matches[0].key)
          }
        }}
        aria-label="Search fields"
        placeholder="Search fields… (Enter inserts the first match)"
        className="w-full px-3 py-2 text-sm border-b border-gray-200 rounded-t-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="max-h-40 overflow-y-auto p-2 space-y-2">
        {matches.length === 0 && <p className="text-sm text-gray-500 px-1">No fields match “{query}”</p>}
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1 px-1">{group}</div>
            <div className="flex flex-wrap gap-2">
              {items.map((field) => {
                const missing = missingCounts[field.key] ?? 0
                const hint = missing ? ` (empty for ${missing} of ${selectedCount} selected)` : ''
                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => insert(field.key)}
                    title={`Insert {${field.key}}${hint}`}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                  >
                    {field.label}
                    {missing > 0 && (
                      <span className="ml-1 text-amber-700" aria-label={hint}>
                        ⚠ {missing}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
