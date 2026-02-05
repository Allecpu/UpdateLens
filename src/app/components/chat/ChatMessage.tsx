import { useEffect, useMemo, useState } from 'react';
import type { ChatMessage as ChatMessageData } from '../../store/useChatStore';
import ChatResultPreview from './ChatResultPreview';

type ChatMessageProps = {
  message: ChatMessageData;
  shouldAnimate?: boolean;
  onAnimationComplete?: () => void;
  onApplyFilters?: () => void;
};

const ChatMessage = ({
  message,
  shouldAnimate: shouldAnimateMessage = false,
  onAnimationComplete,
  onApplyFilters
}: ChatMessageProps) => {
  const isUser = message.type === 'user';
  const [visibleLength, setVisibleLength] = useState(isUser ? message.text.length : 0);

  const canAnimate = useMemo(() => {
    if (isUser) return false;
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, [isUser]);

  useEffect(() => {
    if (!shouldAnimateMessage || !canAnimate) {
      setVisibleLength(message.text.length);
      return;
    }

    setVisibleLength(0);
    const intervalId = window.setInterval(() => {
      setVisibleLength((current) => {
        if (current >= message.text.length) {
          window.clearInterval(intervalId);
          return current;
        }
        return current + 2;
      });
    }, 16);

    return () => window.clearInterval(intervalId);
  }, [message.text, shouldAnimateMessage, canAnimate, onAnimationComplete]);

  const displayedText = isUser ? message.text : message.text.slice(0, visibleLength);
  const isTyping = !isUser && visibleLength < message.text.length;

  useEffect(() => {
    if (!shouldAnimateMessage || !canAnimate || isUser) {
      return;
    }
    if (!isTyping) {
      onAnimationComplete?.();
    }
  }, [shouldAnimateMessage, canAnimate, isUser, isTyping, onAnimationComplete]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm">
          {displayedText}
          {isTyping && <span className="ml-0.5 inline-block h-3 w-[1px] animate-pulse bg-foreground/70 align-middle" />}
        </p>
        {!isUser && !isTyping && message.showPreview && message.items && (
          <ChatResultPreview
            items={message.items}
            onApplyFilters={onApplyFilters}
            canApplyFilters={message.canApplyFilters}
          />
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
