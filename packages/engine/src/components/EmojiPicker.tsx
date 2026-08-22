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
              <button
                key={`${emoji}-${i}`}
                type="button"
                title={emoji}
                onClick={() => onPick(emoji)}
                className="flex size-8 items-center justify-center rounded-md text-xl leading-none transition-colors hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
