import { useState } from 'react';
import type { CssActivity } from '../../models/Css';

export type GroupByKey = 'status' | 'customer' | 'owner' | null;

interface GroupingPanelProps {
  activities: CssActivity[];
  groupBy: GroupByKey;
  onGroupByChange: (key: GroupByKey) => void;
}

export function GroupingPanel({ activities, groupBy, onGroupByChange }: GroupingPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getGroupValue = (activity: CssActivity, key: GroupByKey): string => {
    if (!key) return '';
    switch (key) {
      case 'status':
        return activity.issueStatus || 'No Status';
      case 'customer':
        return activity.customerName || 'No Customer';
      case 'owner':
        return activity.cssOwner || 'No Owner';
      default:
        return '';
    }
  };

  const getGroupedData = () => {
    if (!groupBy) return null;

    const grouped: Record<string, CssActivity[]> = {};
    activities.forEach((activity) => {
      const key = getGroupValue(activity, groupBy);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(activity);
    });

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  };

  const groupedData = getGroupedData();
  const groupCount = groupedData?.length || 0;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isExpanded ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <span>📊 {groupBy ? `Raggruppato per: ${groupBy.toUpperCase()}` : 'Raggruppa per...'}</span>
        {groupBy && <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">{groupCount}</span>}
      </button>

      {isExpanded && (
        <div className="mt-2 flex flex-wrap gap-2 rounded-lg bg-gray-50 p-3">
          <button
            onClick={() => {
              onGroupByChange(null);
              setIsExpanded(false);
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              !groupBy ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 hover:bg-gray-200'
            }`}
          >
            ✕ Nessun raggruppamento
          </button>

          {['status', 'customer', 'owner'].map((key) => (
            <button
              key={key}
              onClick={() => {
                onGroupByChange(key as GroupByKey);
                setIsExpanded(false);
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                groupBy === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-900 hover:bg-gray-200'
              }`}
            >
              {key === 'status' && '🔴 Status'}
              {key === 'customer' && '👥 Customer'}
              {key === 'owner' && '👤 Owner'}
            </button>
          ))}
        </div>
      )}

      {/* Mostra preview dei gruppi */}
      {groupBy && groupedData && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <div className="font-medium mb-2">📋 Gruppi ({groupCount}):</div>
          <div className="space-y-1">
            {groupedData.slice(0, 5).map(([name, items]) => (
              <div key={name} className="flex justify-between">
                <span>{name}</span>
                <span className="font-bold">{items.length} items</span>
              </div>
            ))}
            {groupCount > 5 && <div className="text-amber-600">... e altri {groupCount - 5} gruppi</div>}
          </div>
        </div>
      )}
    </div>
  );
}
