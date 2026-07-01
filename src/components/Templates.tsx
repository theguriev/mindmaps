import { useState } from 'react'
import { Input } from '@/ui'
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
    <div className="bgl-templates">
      <div className="bgl-title">Select a Template</div>
      <div className="bgl-subtitle">
        To speed up the process, you can select from one of our pre-made
        templates.
      </div>
      <Input value={search} onChange={setSearch} placeholder="Search for a template" />
      <ul>
        {filtered.map((template, index) => (
          <li key={index} onClick={() => onChoose(template)}>
            <b>{template.title.replace('{index}', '')}</b>
            <small>{template.description}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}
