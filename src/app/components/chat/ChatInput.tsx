import { useState, useRef, useEffect, useImperativeHandle, forwardRef, type KeyboardEvent, type ChangeEvent } from 'react';

type ChatInputProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
  suggestions?: string[];
  onInputChange?: (value: string) => void;
};

export type ChatInputHandle = {
  setValue: (text: string) => void;
  focus: () => void;
};

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(({ onSend, disabled, suggestions = [], onInputChange }, ref) => {
  const [value, setValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (suggestions.length > 0 && value.length >= 2) {
      setShowSuggestions(true);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
    }
  }, [suggestions, value]);

  useImperativeHandle(ref, () => ({
    setValue: (text: string) => {
      setValue(text);
      onInputChange?.(text);
    },
    focus: () => {
      inputRef.current?.focus();
    }
  }), [onInputChange]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onInputChange?.(newValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && showSuggestions)) {
        e.preventDefault();
        applySuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault();
      onSend(value.trim());
      setValue('');
      setShowSuggestions(false);
    }
  };

  const applySuggestion = (suggestion: string) => {
    // Replace last word with suggestion
    const words = value.split(/\s+/);
    words[words.length - 1] = suggestion;
    const newValue = words.join(' ') + ' ';
    setValue(newValue);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (value.trim()) {
      onSend(value.trim());
      setValue('');
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    applySuggestion(suggestion);
  };

  return (
    <div className="relative">
      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 mx-3 rounded-lg border border-border bg-popover shadow-lg">
          <div className="max-h-40 overflow-y-auto py-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                  index === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                }`}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <div className="border-t border-border px-3 py-1 text-[10px] text-muted-foreground">
            ↑↓ naviga • Tab/Enter seleziona • Esc chiudi
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-center gap-2 border-t border-border p-3">
        <input
          ref={inputRef}
          type="text"
          className="ul-input flex-1"
          placeholder="Scrivi un messaggio..."
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
        />
        <button
          type="button"
          className="ul-button ul-button-primary h-9 w-9 p-0"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label="Invia messaggio"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22 11 13 2 9 22 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;
