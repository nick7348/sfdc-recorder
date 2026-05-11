import { useState } from 'react';
import type { Recording } from '../../shared/messages.js';

interface Props {
  recording: Recording | null;
  activeGroupId: string | null;
  onStartGroup: (name: string) => void;
  onEndGroup: () => void;
}

export function GroupBar({ recording, activeGroupId, onStartGroup, onEndGroup }: Props): JSX.Element {
  const [groupName, setGroupName] = useState('');
  const activeGroup = recording?.groups.find((g) => g.id === activeGroupId);

  if (activeGroup) {
    return (
      <div className="group-bar active">
        <span className="group-label">in group:</span>
        <strong>{activeGroup.name}</strong>
        <button className="warn" onClick={onEndGroup}>
          End group
        </button>
      </div>
    );
  }

  return (
    <div className="group-bar">
      <input
        type="text"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        placeholder="sub-flow name (e.g. login)"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && groupName.trim()) {
            onStartGroup(groupName.trim());
            setGroupName('');
          }
        }}
      />
      <button
        disabled={!groupName.trim()}
        onClick={() => {
          onStartGroup(groupName.trim());
          setGroupName('');
        }}
      >
        + Group
      </button>
    </div>
  );
}
