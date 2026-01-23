import type { ReleaseItem } from '../../../models/ReleaseItem';

type ChatResultPreviewProps = {
  items: ReleaseItem[];
  onApplyFilters?: () => void;
  canApplyFilters?: boolean;
};

const ChatResultPreview = ({
  items,
  onApplyFilters,
  canApplyFilters
}: ChatResultPreviewProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-lg border border-border bg-card/50 p-3 text-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
              {item.productName}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {item.status}
            </span>
          </div>
          <h4 className="mt-1.5 font-medium leading-tight line-clamp-2">
            {item.title}
          </h4>
          <p className="mt-1 text-muted-foreground line-clamp-2">
            {item.description}
          </p>
        </article>
      ))}
      {canApplyFilters && onApplyFilters && (
        <button
          type="button"
          className="ul-button ul-button-primary w-full text-xs"
          onClick={onApplyFilters}
        >
          Apri vista completa
        </button>
      )}
    </div>
  );
};

export default ChatResultPreview;
