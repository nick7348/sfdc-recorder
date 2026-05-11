/**
 * Background service worker — owns the recording state machine, one per tab.
 *
 * v2 additions:
 *  - assertion mode: clicks in `asserting` mode become assertVisible steps
 *    (or whatever the panel-selected assertion type is)
 *  - group support: `activeGroupId` tags incoming steps
 *  - variable detection: scans inputs for $VAR placeholders
 */

import type {
  GroupEdit,
  Message,
  Recording,
  RecorderMode,
  RecordingGroup,
  RecordingStep,
  StepEdit,
} from './shared/messages.js';

interface TabRecording {
  mode: RecorderMode;
  recording: Recording | null;
  activeGroupId: string | null;
}

const tabState = new Map<number, TabRecording>();

function getOrInit(tabId: number): TabRecording {
  let s = tabState.get(tabId);
  if (!s) {
    s = { mode: 'idle', recording: null, activeGroupId: null };
    tabState.set(tabId, s);
  }
  return s;
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  switch (message.kind) {
    case 'rec/start': {
      const s = getOrInit(message.tabId);
      s.mode = 'recording';
      s.activeGroupId = null;
      s.recording = {
        version: 2,
        name: message.name,
        createdAt: new Date().toISOString(),
        startUrl: '',
        context: 'unknown',
        steps: [],
        groups: [],
        variables: [],
      };
      chrome.tabs.sendMessage(message.tabId, { kind: 'rec/state', tabId: message.tabId });
      sendResponse({ ok: true });
      return true;
    }
    case 'rec/stop': {
      const s = getOrInit(message.tabId);
      s.mode = 'idle';
      s.activeGroupId = null;
      sendResponse({ ok: true, recording: s.recording });
      return true;
    }
    case 'rec/pause':
      getOrInit(message.tabId).mode = 'paused';
      sendResponse({ ok: true });
      return true;
    case 'rec/resume':
      getOrInit(message.tabId).mode = 'recording';
      sendResponse({ ok: true });
      return true;
    case 'rec/set-mode':
      getOrInit(message.tabId).mode = message.mode;
      chrome.tabs.sendMessage(message.tabId, { kind: 'rec/state', tabId: message.tabId });
      sendResponse({ ok: true });
      return true;
    case 'rec/state': {
      const s = getOrInit(message.tabId);
      sendResponse({
        kind: 'rec/snapshot',
        tabId: message.tabId,
        recording: s.recording,
        mode: s.mode,
        activeGroupId: s.activeGroupId,
      } satisfies Message);
      return true;
    }
    case 'rec/append-step': {
      const s = getOrInit(message.tabId);
      if ((s.mode !== 'recording' && s.mode !== 'asserting') || !s.recording) {
        sendResponse({ ok: false, reason: 'not-recording' });
        return true;
      }
      const step = { ...message.step };
      if (s.activeGroupId) step.groupId = s.activeGroupId;
      appendStep(s.recording, step);
      detectVariablesIn(s.recording, step);
      sendResponse({ ok: true });
      return true;
    }
    case 'rec/edit': {
      const s = getOrInit(message.tabId);
      if (!s.recording) {
        sendResponse({ ok: false, reason: 'no-recording' });
        return true;
      }
      applyEdit(s.recording, message.edit);
      sendResponse({ ok: true });
      return true;
    }
    case 'rec/group': {
      const s = getOrInit(message.tabId);
      if (!s.recording) {
        sendResponse({ ok: false, reason: 'no-recording' });
        return true;
      }
      applyGroupEdit(s, message.edit);
      sendResponse({ ok: true });
      return true;
    }
  }
});

function appendStep(rec: Recording, step: RecordingStep): void {
  const last = rec.steps[rec.steps.length - 1];
  if (
    last &&
    step.action.type === 'input' &&
    last.action.type === 'input' &&
    sameElement(last, step)
  ) {
    last.action = step.action;
    last.timestamp = step.timestamp;
    return;
  }
  rec.steps.push(step);
}

function sameElement(a: RecordingStep, b: RecordingStep): boolean {
  if (!('snapshot' in a.action) || !('snapshot' in b.action)) return false;
  const ax = a.action.snapshot.candidates[0]?.playwright;
  const bx = b.action.snapshot.candidates[0]?.playwright;
  return Boolean(ax && bx && ax === bx);
}

const VAR_RE = /\$\{?([A-Z_][A-Z0-9_]*)\}?/g;

function detectVariablesIn(rec: Recording, step: RecordingStep): void {
  const a = step.action;
  const candidates: string[] = [];
  if ('value' in a && typeof a.value === 'string') candidates.push(a.value);
  if ('optionLabel' in a) candidates.push((a as { optionLabel: string }).optionLabel);
  if ('searchText' in a) candidates.push((a as { searchText: string }).searchText);
  if ('expected' in a && typeof a.expected === 'string') candidates.push(a.expected);
  for (const text of candidates) {
    for (const m of text.matchAll(VAR_RE)) {
      const name = m[1];
      if (name && !rec.variables.includes(name)) rec.variables.push(name);
    }
  }
}

function applyEdit(rec: Recording, edit: StepEdit): void {
  switch (edit.op) {
    case 'rename':
      rec.name = edit.name.trim() || rec.name;
      return;
    case 'delete': {
      const idx = rec.steps.findIndex((s) => s.id === edit.stepId);
      if (idx >= 0) rec.steps.splice(idx, 1);
      return;
    }
    case 'move': {
      const idx = rec.steps.findIndex((s) => s.id === edit.stepId);
      if (idx < 0) return;
      const swap = edit.direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= rec.steps.length) return;
      const tmp = rec.steps[idx]!;
      rec.steps[idx] = rec.steps[swap]!;
      rec.steps[swap] = tmp;
      return;
    }
    case 'set-comment': {
      const step = rec.steps.find((s) => s.id === edit.stepId);
      if (step) step.comment = edit.comment;
      return;
    }
  }
}

function applyGroupEdit(state: TabRecording, edit: GroupEdit): void {
  const rec = state.recording;
  if (!rec) return;
  switch (edit.op) {
    case 'start': {
      const id = crypto.randomUUID();
      const group: RecordingGroup = { id, name: edit.name.trim() || 'sub-flow' };
      rec.groups.push(group);
      state.activeGroupId = id;
      return;
    }
    case 'end':
      state.activeGroupId = null;
      return;
    case 'rename-group': {
      const g = rec.groups.find((x) => x.id === edit.groupId);
      if (g) g.name = edit.name.trim() || g.name;
      return;
    }
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    const s = getOrInit(tabId);
    if (s.mode === 'recording' && s.recording) {
      if (!s.recording.startUrl) s.recording.startUrl = changeInfo.url;
      const step: RecordingStep = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        action: { type: 'navigate', url: changeInfo.url },
      };
      if (s.activeGroupId) step.groupId = s.activeGroupId;
      s.recording.steps.push(step);
    }
  }
});
