import type { LucideIcon } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@/components/ui/command'

export interface MenuCommand {
  group: string
  label: string
  shortcut?: string
  icon?: LucideIcon
  run: () => void
}

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: MenuCommand[]
}

/** A ⌘K command palette listing the editor's actions and their shortcuts. */
export function CommandMenu ({ open, onOpenChange, commands }: CommandMenuProps) {
  const groups = Array.from(new Set(commands.map((c) => c.group)))
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command menu"
      description="Search for a command to run"
    >
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group} heading={group}>
            {commands
              .filter((c) => c.group === group)
              .map((c) => {
                const Icon = c.icon
                return (
                  <CommandItem
                    key={c.label}
                    onSelect={() => {
                      onOpenChange(false)
                      c.run()
                    }}
                  >
                    {Icon && <Icon />}
                    <span>{c.label}</span>
                    {c.shortcut && <CommandShortcut>{c.shortcut}</CommandShortcut>}
                  </CommandItem>
                )
              })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
