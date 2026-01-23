import { useState, type KeyboardEvent, type ChangeEvent } from 'react';

type ChatInputProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [value, setValue] = useState('');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault();
      onSend(value.trim());
      setValue('');
    }
  };

  const handleSend = () => {
    if (value.trim()) {
      onSend(value.trim());
      setValue('');
    }
  };

  return (
    <div className="flex items-center gap-2 border-t border-border p-3">
      <input
        type="text"
        className="ul-input flex-1"
        placeholder="Scrivi un messaggio..."
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
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
  );
};

export default ChatInput;
