import { describe, expect, it, vi } from 'vitest'
import type { MenuCommand } from '@mindmaps/engine'
import { COMMAND_PREFIX, commandLabel, commandName, commandStore, registerCommands } from './commands'

const command = (over: Partial<MenuCommand> = {}): MenuCommand => ({
  group: 'Edit',
  label: 'Undo',
  run: () => {},
  ...over
})

describe('commandName', () => {
  it('namespaces and slugifies, so nothing collides with a core command', () => {
    expect(commandName(command())).toBe(`${COMMAND_PREFIX}edit-undo`)
    expect(commandName(command({ group: 'Go', label: 'Find node…' }))).toBe(
      `${COMMAND_PREFIX}go-find-node`
    )
  })

  it('names a command by what it is, not by where it sits in the list', () => {
    // The list grows and shrinks with the selection; an index would rename
    // every command below the one that appeared.
    expect(commandName(command())).toBe(commandName(command()))
  })
})

describe('commandLabel', () => {
  it('says whose command it is, because the palette is the whole site', () => {
    expect(commandLabel(command())).toBe('Mind map: Undo')
  })

  it('carries the shortcut, which is how you stop needing the palette', () => {
    expect(commandLabel(command({ shortcut: '⌘Z' }))).toBe('Mind map: Undo (⌘Z)')
  })
})

describe('commandStore', () => {
  it('finds the palette in the admin', () => {
    const registerCommand = vi.fn()
    const unregisterCommand = vi.fn()
    const scope = {
      wp: { data: { dispatch: () => ({ registerCommand, unregisterCommand }) } }
    }
    expect(commandStore(scope)).not.toBeNull()
  })

  it('finds none on the front end, where the editor keeps its own', () => {
    expect(commandStore({})).toBeNull()
    expect(commandStore({ wp: {} })).toBeNull()
    expect(commandStore({ wp: { data: { dispatch: () => undefined } } })).toBeNull()
    // A store that exists but is not the one we mean.
    expect(commandStore({ wp: { data: { dispatch: () => ({ open: () => {} }) } } })).toBeNull()
  })
})

describe('registerCommands', () => {
  function fakeStore () {
    const registered = new Map<string, { label: string, callback: (a: { close?: () => void }) => void }>()
    return {
      registered,
      register: (c: { name: string, label: string, callback: (a: { close?: () => void }) => void }) =>
        registered.set(c.name, { label: c.label, callback: c.callback }),
      unregister: (name: string) => registered.delete(name)
    }
  }

  it('registers each command and takes them all back', () => {
    const store = fakeStore()
    const commands = [command(), command({ group: 'View', label: 'Zoom in' })]

    const stop = registerCommands(store, commands.map(commandName), () => commands)

    expect([...store.registered.keys()]).toEqual([
      `${COMMAND_PREFIX}edit-undo`,
      `${COMMAND_PREFIX}view-zoom-in`
    ])
    stop()
    expect(store.registered.size).toBe(0)
  })

  it('runs the current command, not the one registration saw', () => {
    // The editor rebuilds its commands every render; a palette entry created
    // once must not keep calling the version that closed over a stale map.
    const store = fakeStore()
    const calls: string[] = []
    let commands = [command({ run: () => calls.push('stale') })]

    registerCommands(store, commands.map(commandName), () => commands)
    commands = [command({ run: () => calls.push('fresh') })]

    store.registered.get(`${COMMAND_PREFIX}edit-undo`)?.callback({ close: () => {} })

    expect(calls).toEqual(['fresh'])
  })

  it('closes the palette before running, so the map is what you see', () => {
    const store = fakeStore()
    const order: string[] = []
    const commands = [command({ run: () => order.push('run') })]

    registerCommands(store, commands.map(commandName), () => commands)
    store.registered
      .get(`${COMMAND_PREFIX}edit-undo`)
      ?.callback({ close: () => order.push('close') })

    expect(order).toEqual(['close', 'run'])
  })

  it('does nothing for a name the editor no longer offers', () => {
    const store = fakeStore()
    registerCommands(store, [`${COMMAND_PREFIX}edit-undo`], () => [])

    expect(() =>
      store.registered.get(`${COMMAND_PREFIX}edit-undo`)?.callback({ close: () => {} })
    ).not.toThrow()
  })
})
