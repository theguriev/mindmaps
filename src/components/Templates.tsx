import { useState } from 'react'
import { Input } from '@/components/ui/input'
import type { TemplateDoc } from '@/templates'

export function Templates ({
  templates,
  onChoose
}: {
  templates: TemplateDoc[]
  onChoose: (template: TemplateDoc) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = templates.filter(
    (t) =>
      t.title.indexOf(search) > -1 || (t.description ?? '').indexOf(search) > -1
  )

  return (
    <div>
      <div className="text-base font-semibold">Select a Template</div>
      <div className="mb-2 text-xs text-muted-foreground">
        To speed up the process, you can select from one of our pre-made
        templates.
      </div>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search for a template"
      />
      <ul className="mt-2 max-h-80 space-y-1 overflow-auto">
        {filtered.map((template, index) => (
          <li
            key={index}
            onClick={() => onChoose(template)}
            className="flex cursor-pointer flex-col rounded-md p-2 hover:bg-secondary"
          >
            <b className="font-semibold">{template.title.replace('{index}', '')}</b>
            <small className="text-xs text-muted-foreground">
              {template.description}
            </small>
          </li>
        ))}
      </ul>
    </div>
  )
}
