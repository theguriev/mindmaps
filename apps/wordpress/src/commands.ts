/**
 * Putting the editor's commands into WordPress's own palette.
 *
 * The admin already answers ⌘K with "Search commands and settings", and the
 * editor used to answer it too — which of the two you got depended on where
 * the focus happened to be, and neither knew about the other's actions. So in
 * the admin the editor stands down (`onCommands` takes the list off its hands)
 * and its actions are registered into `core/commands` instead, where they sit
 * beside "Go to: Posts" and everything else the site can do.
 *
 * Only in the admin: `wp-commands` is not loaded on the front end, so a
 * shortcode or block embed keeps the editor's own palette. That is the whole
 * job of `commandStore()` — say whether there is a palette to merge into.
 */
import type { MenuCommand } from '@mindmaps/engine'

/** What we use of `@wordpress/data`'s `core/commands` store. */
interface CommandStore {
  register: (command: { name: string, label: string, callback: (args: { close?: () => void }) => void }) => void
  unregister: (name: string) => void
}

/** Namespaced so nothing we add can collide with a core command, or a plugin's. */
export const COMMAND_PREFIX = 'mind-maps/'

/**
 * The label a command gets in WordPress's palette.
 *
 * Prefixed because the palette is flat and site-wide — "Undo" on its own says
 * nothing about what it would undo, next to forty commands that navigate the
 * admin. The shortcut rides along in the label for the same reason the
 * editor's own palette showed one: it is the fastest way to stop needing the
 * palette.
 */
export function commandLabel (command: MenuCommand): string {
  return command.shortcut === undefined
    ? `Mind map: ${command.label}`
    : `Mind map: ${command.label} (${command.shortcut})`
}

/** A stable id for a command, derived from what it is rather than where it is
 *  in the list — the list grows and shrinks with the selection. */
export function commandName (command: MenuCommand): string {
  const slug = `${command.group}-${command.label}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return COMMAND_PREFIX + slug
}

/**
 * The `core/commands` store, or null where there is no palette to merge into.
 *
 * Deliberately duck-typed rather than imported: `@wordpress/data` is a global
 * the admin provides, the embed does not bundle it, and on the front end it is
 * simply absent.
 */
export function commandStore (scope: unknown = globalThis): CommandStore | null {
  const wp = (scope as { wp?: Record<string, unknown> }).wp
  const data = wp?.data as
    | {
      dispatch?: (store: string) => Record<string, unknown> | undefined
    }
    | undefined
  const actions = data?.dispatch?.('core/commands')
  const register = actions?.registerCommand
  const unregister = actions?.unregisterCommand
  if (typeof register !== 'function' || typeof unregister !== 'function') return null

  return {
    register: register as CommandStore['register'],
    unregister: unregister as CommandStore['unregister']
  }
}

/**
 * Mirror a set of commands into the palette until the returned function is
 * called.
 *
 * `latest` is read at the moment the command runs rather than captured, which
 * is what keeps a registration made once from running a stale action: the
 * editor rebuilds its commands on every render, and `undo` from three renders
 * ago undoes the wrong thing.
 *
 * Icons are left behind on purpose. They are React components from the embed's
 * own React, and the palette renders them with WordPress's — a different copy,
 * which does not recognise the other's elements.
 */
export function registerCommands (
  store: CommandStore,
  names: string[],
  latest: () => MenuCommand[]
): () => void {
  for (const name of names) {
    store.register({
      name,
      label: commandLabel(
        latest().find((command) => commandName(command) === name) ?? {
          group: '',
          label: name,
          run: () => {}
        }
      ),
      callback: ({ close }) => {
        close?.()
        latest().find((command) => commandName(command) === name)?.run()
      }
    })
  }

  return () => {
    for (const name of names) store.unregister(name)
  }
}
