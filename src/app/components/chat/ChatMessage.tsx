import type { ChatMessage as ChatMessageData } from '../../store/useChatStore';
import ChatResultPreview from './ChatResultPreview';

type ChatMessageProps = {
  message: ChatMessageData;
  onApplyFilters?: () => void;
};

const ChatMessage = ({ message, onApplyFilters }: ChatMessageProps) => {
  const isUser = message.type === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm">{message.text}</p>
        {!isUser && message.showPreview && message.items && (
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
