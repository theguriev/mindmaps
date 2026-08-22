import { Button } from './ui/button'

/** A small, self-contained emoji picker (curated set, grouped by category). */
export const EMOJI_GROUPS: Array<{ name: string; emojis: string[] }> = [
  {
    name: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '😜',
      '🤪', '🤗', '🤔', '🤭', '😐', '😴', '😌', '😔', '😢', '😭',
      '😤', '😠', '😡', '🤯', '😳', '🥵', '🥶', '😱', '🥳', '🤠'
    ]
  },
  {
    name: 'Gestures',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👏', '🙌', '🙏',
      '💪', '👋', '🤙', '✋', '👊', '🤝', '🫶', '🤌'
    ]
  },
  {
    name: 'Hearts',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💖',
      '💗', '💓', '💞', '💕', '💘', '💝', '❣️', '💔'
    ]
  },
  {
    name: 'Symbols',
    emojis: [
      '✅', '❌', '⭐', '🌟', '🔥', '💯', '🎉', '🎊', '🚀', '💡',
      '📌', '🏆', '✨', '⚡', '❓', '❗', '➕', '⚠️', '🎯', '💎'
    ]
  },
  {
    name: 'Other',
    emojis: [
      '🌈', '☀️', '🌙', '☕', '🍕', '🍔', '🍺', '🎂', '🍎', '🐶',
      '🐱', '🦄', '🌸', '💤', '👀', '🧠', '🔔', '📎'
    ]
  }
]

interface EmojiPickerProps {
  onPick: (emoji: string) => void
}

export function EmojiPicker ({ onPick }: EmojiPickerProps) {
  return (
    <div className="max-h-72 w-72 overflow-y-auto">
      {EMOJI_GROUPS.map((group) => (
        <div key={group.name} className="mb-2">
          <div className="mb-1 px-1 text-xs font-medium text-muted-foreground">
            {group.name}
          </div>
          <div className="grid grid-cols-8 gap-0.5">
            {group.emojis.map((emoji, i) => (
              // No tooltip here: it would only repeat the glyph already on the
              // button, at the cost of a Radix root in each of a hundred cells.
              <Button
                key={`${emoji}-${i}`}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={emoji}
                onClick={() => onPick(emoji)}
                className="size-8 text-xl leading-none hover:bg-muted"
              >
                {emoji}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
