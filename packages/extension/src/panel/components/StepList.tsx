import { useState } from 'react';
import type { RecordingGroup, RecordingStep, StepEdit } from '../../shared/messages.js';

interface Props {
  steps: RecordingStep[];
  groups: RecordingGroup[];
  editable: boolean;
  onEdit: (edit: StepEdit) => void;
}

export function StepList({ steps, groups, editable, onEdit }: Props): JSX.Element {
  if (steps.length === 0) {
    return (
      <div className="empty">
        <p>No steps yet.</p>
        <p>
          Hit <strong>Start recording</strong>, then walk through your user story in Salesforce.
        </p>
      </div>
    );
  }

  const groupMap = new Map(groups.map((g) => [g.id, g] as const));

  return (
    <ol className="steps">
      {steps.map((step, idx) => (
        <StepRow
          key={step.id}
          step={step}
          index={idx}
          total={steps.length}
          editable={editable}
          group={step.groupId ? groupMap.get(step.groupId) : undefined}
          onEdit={onEdit}
        />
      ))}
    </ol>
  );
}

function StepRow({
  step,
  index,
  total,
  editable,
  group,
  onEdit,
}: {
  step: RecordingStep;
  index: number;
  total: number;
  editable: boolean;
  group?: RecordingGroup;
  onEdit: (edit: StepEdit) => void;
}): JSX.Element {
  const [editingComment, setEditingComment] = useState(false);
  const [draftComment, setDraftComment] = useState(step.comment ?? '');

  function commitComment(): void {
    onEdit({ op: 'set-comment', stepId: step.id, comment: draftComment });
    setEditingComment(false);
  }

  const kind = step.action.type;
  const isAssertion = kind.startsWith('assert');

  return (
    <li className={`step-row ${isAssertion ? 'assertion' : ''}`}>
      <span className="step-num">{index + 1}</span>
      <div className="step-body">
        <div className="step-summary">
          {isAssertion && <span className="step-icon">✓</span>}
          {summarize(step)}
        </div>
        {group && <div className="step-group">▤ {group.name}</div>}
        {step.comment && !editingComment && (
          <div className="step-comment" title="step comment">
            “{step.comment}”
          </div>
        )}
        {editingComment && (
          <div className="step-comment-edit">
            <input
              autoFocus
              value={draftComment}
              onChange={(e) => setDraftComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitComment();
                if (e.key === 'Escape') setEditingComment(false);
              }}
              placeholder="Add a comment for this step…"
            />
            <button onClick={commitComment}>save</button>
          </div>
        )}
      </div>
      {editable && (
        <div className="step-actions">
          <button
            title="move up"
            disabled={index === 0}
            onClick={() => onEdit({ op: 'move', stepId: step.id, direction: 'up' })}
          >
            ▲
          </button>
          <button
            title="move down"
            disabled={index === total - 1}
            onClick={() => onEdit({ op: 'move', stepId: step.id, direction: 'down' })}
          >
            ▼
          </button>
          <button title="comment" onClick={() => setEditingComment((v) => !v)}>
            💬
          </button>
          <button
            title="delete"
            className="danger-icon"
            onClick={() => {
              if (confirm('Delete this step?')) {
                onEdit({ op: 'delete', stepId: step.id });
              }
            }}
          >
            🗑
          </button>
        </div>
      )}
    </li>
  );
}

function summarize(step: RecordingStep): string {
  const a = step.action;
  switch (a.type) {
    case 'click':
      return `click ${describe(a.snapshot)}`;
    case 'dblclick':
      return `double-click ${describe(a.snapshot)}`;
    case 'input':
      return `type "${truncate(a.value)}" into ${describe(a.snapshot)}`;
    case 'change':
      return `change ${describe(a.snapshot)} to "${truncate(a.value)}"`;
    case 'select':
      return `select "${truncate(a.value)}" in ${describe(a.snapshot)}`;
    case 'press':
      return `press ${a.key}`;
    case 'navigate':
      return `navigate to ${a.url}`;
    case 'waitFor':
      return `wait: ${a.reason}`;
    case 'picklist':
      return `picklist: pick "${a.optionLabel}"`;
    case 'multipicklist':
      return `multi-picklist: [${a.optionLabels.join(', ')}]`;
    case 'lookup':
      return `lookup: "${a.searchText}" → "${a.selectedRecord}"`;
    case 'combobox':
      return `combobox: pick "${a.optionLabel}"`;
    case 'date':
    case 'datetime':
      return `${a.type} ${a.isoValue}`;
    case 'checkbox':
      return `${a.checked ? 'check' : 'uncheck'} ${describe(a.snapshot)}`;
    case 'fileUpload':
      return `upload ${a.filePaths.length} file(s)`;
    case 'assertVisible':
      return `assert visible: ${describe(a.snapshot)}`;
    case 'assertHidden':
      return `assert hidden: ${describe(a.snapshot)}`;
    case 'assertText':
      return `assert text "${truncate(a.expected)}" on ${describe(a.snapshot)}`;
    case 'assertValue':
      return `assert value "${truncate(a.expected)}" on ${describe(a.snapshot)}`;
    case 'assertUrl':
      return `assert URL "${truncate(a.expected)}"`;
    case 'assertToast':
      return `assert toast${a.text ? ` "${truncate(a.text)}"` : ''}`;
  }
}

function describe(snapshot: { candidates: { description: string }[]; tagName: string }): string {
  return snapshot.candidates[0]?.description ?? `<${snapshot.tagName}>`;
}

function truncate(s: string): string {
  return s.length > 40 ? s.slice(0, 40) + '…' : s;
}
