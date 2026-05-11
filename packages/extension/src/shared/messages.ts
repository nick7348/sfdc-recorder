import type { ElementSnapshot, SalesforceContext } from '@sfdc-recorder/locator-engine';

/** Action types — kept in sync with @sfdc-recorder/codegen RecordedAction. */
export type RecordedAction =
  | { type: 'click'; snapshot: ElementSnapshot }
  | { type: 'dblclick'; snapshot: ElementSnapshot }
  | { type: 'input'; snapshot: ElementSnapshot; value: string }
  | { type: 'change'; snapshot: ElementSnapshot; value: string }
  | { type: 'select'; snapshot: ElementSnapshot; value: string }
  | { type: 'press'; snapshot: ElementSnapshot; key: string }
  | { type: 'navigate'; url: string }
  | { type: 'waitFor'; reason: string }
  | { type: 'picklist'; snapshot: ElementSnapshot; optionLabel: string }
  | { type: 'multipicklist'; snapshot: ElementSnapshot; optionLabels: string[] }
  | { type: 'lookup'; snapshot: ElementSnapshot; searchText: string; selectedRecord: string }
  | { type: 'combobox'; snapshot: ElementSnapshot; optionLabel: string }
  | { type: 'date' | 'datetime'; snapshot: ElementSnapshot; isoValue: string }
  | { type: 'checkbox'; snapshot: ElementSnapshot; checked: boolean }
  | { type: 'fileUpload'; snapshot: ElementSnapshot; filePaths: string[] }
  | { type: 'assertVisible' | 'assertHidden'; snapshot: ElementSnapshot }
  | { type: 'assertText'; snapshot: ElementSnapshot; expected: string; match?: 'exact' | 'contains' | 'regex' }
  | { type: 'assertValue'; snapshot: ElementSnapshot; expected: string }
  | { type: 'assertUrl'; expected: string; match?: 'contains' | 'exact' | 'regex' }
  | { type: 'assertToast'; text?: string; variant?: 'success' | 'error' | 'warning' | 'info' };

export interface RecordingStep {
  id: string;
  timestamp: number;
  action: RecordedAction;
  comment?: string;
  groupId?: string;
}

export interface RecordingGroup {
  id: string;
  name: string;
  description?: string;
}

export interface Recording {
  version: 2;
  name: string;
  createdAt: string;
  startUrl: string;
  context: SalesforceContext;
  steps: RecordingStep[];
  groups: RecordingGroup[];
  variables: string[];
}

/** Recorder mode — drives whether clicks become actions or assertions. */
export type RecorderMode = 'idle' | 'recording' | 'asserting' | 'paused';

export type StepEdit =
  | { op: 'delete'; stepId: string }
  | { op: 'move'; stepId: string; direction: 'up' | 'down' }
  | { op: 'set-comment'; stepId: string; comment: string }
  | { op: 'rename'; name: string };

export type GroupEdit =
  | { op: 'start'; name: string }
  | { op: 'end' }
  | { op: 'rename-group'; groupId: string; name: string };

export type Message =
  | { kind: 'rec/start'; tabId: number; name: string }
  | { kind: 'rec/stop'; tabId: number }
  | { kind: 'rec/pause'; tabId: number }
  | { kind: 'rec/resume'; tabId: number }
  | { kind: 'rec/state'; tabId: number }
  | { kind: 'rec/append-step'; tabId: number; step: RecordingStep }
  | { kind: 'rec/edit'; tabId: number; edit: StepEdit }
  | { kind: 'rec/group'; tabId: number; edit: GroupEdit }
  | { kind: 'rec/set-mode'; tabId: number; mode: 'recording' | 'asserting' | 'paused' }
  | { kind: 'rec/snapshot'; tabId: number; recording: Recording | null; mode: RecorderMode; activeGroupId: string | null };
