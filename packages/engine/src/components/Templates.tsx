import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from './ui/command'
import type { TemplateChoice } from '../templates'

/** Item values are `index::title` — the index prefix keeps values unique when
 *  two templates share a title, and matching starts after the first `::` so a
 *  query never hits it. The description rides along as a cmdk keyword. */
function matchTemplate (value: string, search: string, keywords?: string[]): number {
  const needle = search.toLowerCase().trim()
  const title = value.slice(value.indexOf('::') + 2)
  return [title, ...(keywords ?? [])].some((text) =>
    text.toLowerCase().includes(needle)
  )
    ? 1
    : 0
}

export function Templates ({
  templates,
  onChoose
}: {
  templates: TemplateChoice[]
  onChoose: (template: TemplateChoice) => void
}) {
  return (
    <div>
      <div className="text-base font-semibold">Select a Template</div>
      <div className="mb-2 text-xs text-muted-foreground">
        To speed up the process, you can select from one of our pre-made
        templates.
      </div>
      <Command filter={matchTemplate}>
        <CommandInput placeholder="Search for a template" />
        <CommandList className="max-h-80">
          <CommandEmpty>No templates found.</CommandEmpty>
          <CommandGroup>
            {templates.map((template, index) => {
              // `{index}` is substituted when the map is created, not in the list.
              const title = template.title.replace('{index}', '')
              return (
                <CommandItem
                  key={index}
                  value={`${index}::${title}`}
                  keywords={template.description ? [template.description] : undefined}
                  onSelect={() => onChoose(template)}
                  className="cursor-pointer flex-col items-start gap-0 p-2"
                >
                  <b className="font-semibold">{title}</b>
                  <small className="text-xs text-muted-foreground">
                    {template.description}
                  </small>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}
