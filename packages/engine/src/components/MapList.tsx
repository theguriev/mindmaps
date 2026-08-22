import { useState, type ReactNode, type Ref } from 'react'
import { ChevronDownIcon, FolderOpenIcon, SearchIcon } from 'lucide-react'
import { Logo } from './Logo'
import { MapItem } from './MapItem'
import { Templates } from './Templates'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Separator } from './ui/separator'
import type { MapDoc } from '../mindmap/types'
import type { TemplateDoc } from '../templates'

export interface MapListProps {
  maps: MapDoc[]
  /** Offered by the "New" popover. */
  templates: TemplateDoc[]
  /**
   * A visitor who may not write. Creating a map is a write — without the
   * capability the request would be refused — so the affordance is absent
   * rather than broken, and the rows lose their actions for the same reason.
   */
  readOnly?: boolean
  /** Sits under the toolbar; the WordPress embed reports failed mutations here. */
  notice?: ReactNode
  /**
   * Open the template picker on mount — the WordPress admin bar's
   * "+ New → Mind Map" lands here, and arriving at a list is not what it asked
   * for. Nothing is created until a template is chosen.
   */
  startNew?: boolean
  /** Passed through to every row — see `MapItemProps.formatModified`. */
  formatModified?: (modified: string) => string
  /**
   * The scrolling box. A host that centres a new map on the screen it is
   * about to replace measures this element.
   */
  ref?: Ref<HTMLDivElement>
  onGo: (map: MapDoc) => void
  onRemove: (map: MapDoc, done: () => void) => void
  onStar: (map: MapDoc, done: () => void) => void
  onUnstar: (map: MapDoc, done: () => void) => void
  onChooseTemplate: (template: TemplateDoc) => void
}

/**
 * The "my maps" screen, shared by both hosts.
 *
 * It owns everything that is the same wherever the list is embedded — the
 * heading, the search box, the "New" popover and the rows — so a host only
 * brings its storage, its navigation and, where it differs, its own date
 * format. Nothing here measures the viewport: the WordPress embed is sized by
 * the box the shortcode was dropped into, not by the window.
 */
export function MapList ({
  maps,
  templates,
  readOnly = false,
  notice,
  startNew = false,
  formatModified,
  ref,
  onGo,
  onRemove,
  onStar,
  onUnstar,
  onChooseTemplate
}: MapListProps) {
  const [filterText, setFilterText] = useState('')
  const [creating, setCreating] = useState(startNew && !readOnly)

  const needle = filterText.toLocaleLowerCase()
  const filteredMaps = maps.filter((el) =>
    (el.title ?? '').toLocaleLowerCase().includes(needle)
  )

  // "Nothing here yet" and "nothing matched" are different problems, and only
  // the first one is solved by creating a map.
  const emptyMessage =
    maps.length > 0
      ? `No maps match “${filterText}”.`
      : readOnly
        ? 'No maps to show.'
        : 'No maps yet — create one!'

  return (
    <div ref={ref} className="h-full overflow-auto">
      <div className="mx-auto my-6 w-[960px] max-w-[calc(100%-2rem)]">
        <div className="flex items-center">
          {/* The heading names the product, so the mark is decorative. */}
          <Logo className="mr-3" alt="" />
          <h1 className="text-3xl font-bold">Mind maps</h1>
        </div>
        <Separator className="my-4" />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Find a map..."
              aria-label="Find a map"
            />
          </div>
          {!readOnly && (
            <Popover open={creating} onOpenChange={setCreating}>
              <PopoverTrigger asChild>
                <Button>
                  New
                  <ChevronDownIcon aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="end">
                <Templates templates={templates} onChoose={onChooseTemplate} />
              </PopoverContent>
            </Popover>
          )}
        </div>
        {notice}
        <div className="mt-6 mb-1 flex items-center gap-2">
          <h2 className="text-sm font-semibold">Maps</h2>
          <Badge variant="secondary">{filteredMaps.length}</Badge>
        </div>
        {filteredMaps.length > 0 ? (
          <ul className="flex list-none flex-col">
            {filteredMaps.map((map) => (
              <MapItem
                key={String(map.id)}
                map={map}
                readOnly={readOnly}
                formatModified={formatModified}
                onGo={onGo}
                onRemove={onRemove}
                onStar={onStar}
                onUnstar={onUnstar}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <FolderOpenIcon className="size-10 opacity-50" aria-hidden="true" />
            <div>{emptyMessage}</div>
          </div>
        )}
      </div>
    </div>
  )
}
