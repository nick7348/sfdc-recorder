import { useEffect, useState } from 'react';
import type { Message, Recording, RecorderMode } from '../shared/messages.js';
import { Controls } from './components/Controls.js';
import { StepList } from './components/StepList.js';
import { GroupBar } from './components/GroupBar.js';

export function App(): JSX.Element {
  const [tabId, setTabId] = useState<number | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [mode, setMode] = useState<RecorderMode>('idle');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [name, setName] = useState('untitled-story');

  useEffect(() => {
    void (async () => {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!active?.id) return;
      setTabId(active.id);
      await refresh(active.id);
    })();
    const interval = setInterval(() => {
      if (tabId) void refresh(tabId);
    }, 750);
    return () => clearInterval(interval);
  }, [tabId]);

  async function refresh(id: number): Promise<void> {
    const reply = (await chrome.runtime.sendMessage({ kind: 'rec/state', tabId: id } satisfies Message)) as
      | (Message & { kind: 'rec/snapshot' })
      | undefined;
    if (!reply) return;
    setRecording(reply.recording);
    setMode(reply.mode);
    setActiveGroupId(reply.activeGroupId);
  }

  async function send(message: Message): Promise<void> {
    await chrome.runtime.sendMessage(message);
    if (tabId) await refresh(tabId);
  }

  function exportRecording(): void {
    if (!recording) return;
    const blob = new Blob([JSON.stringify(recording, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.name || 'recording'}.recording.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isRecording = mode !== 'idle';
  const isPaused = mode === 'paused';
  const isAsserting = mode === 'asserting';

  return (
    <main className="panel">
      <header>
        <h1>SFDC Recorder</h1>
        <span
          className={`badge ${
            mode === 'idle'
              ? 'idle'
              : mode === 'paused'
                ? 'paused'
                : mode === 'asserting'
                  ? 'assert'
                  : 'live'
          }`}
        >
          {mode}
        </span>
      </header>

      <label className="name-row">
        <span>Story name</span>
        <input
          type="text"
          value={name}
          disabled={isRecording}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. create-account-with-contact"
        />
      </label>

      <Controls
        isRecording={isRecording}
        isPaused={isPaused}
        isAsserting={isAsserting}
        canExport={!!recording && recording.steps.length > 0}
        onStart={() => tabId && void send({ kind: 'rec/start', tabId, name })}
        onStop={() => tabId && void send({ kind: 'rec/stop', tabId })}
        onPause={() => tabId && void send({ kind: 'rec/pause', tabId })}
        onResume={() => tabId && void send({ kind: 'rec/resume', tabId })}
        onToggleAssert={() =>
          tabId &&
          void send({
            kind: 'rec/set-mode',
            tabId,
            mode: isAsserting ? 'recording' : 'asserting',
          })
        }
        onExport={exportRecording}
      />

      {isRecording && (
        <GroupBar
          recording={recording}
          activeGroupId={activeGroupId}
          onStartGroup={(groupName) =>
            tabId && void send({ kind: 'rec/group', tabId, edit: { op: 'start', name: groupName } })
          }
          onEndGroup={() => tabId && void send({ kind: 'rec/group', tabId, edit: { op: 'end' } })}
        />
      )}

      <StepList
        steps={recording?.steps ?? []}
        groups={recording?.groups ?? []}
        editable={!isRecording || isPaused}
        onEdit={(edit) => tabId && void send({ kind: 'rec/edit', tabId, edit })}
      />

      {recording?.variables && recording.variables.length > 0 && (
        <div className="vars-row" title="Variables detected in recorded values">
          <strong>vars:</strong> {recording.variables.map((v) => `$${v}`).join(', ')}
        </div>
      )}

      <footer>
        <small>
          {recording?.steps.length ?? 0} step(s) · {recording?.groups.length ?? 0} group(s) ·{' '}
          <a
            href="https://github.com/your-org/sfdc-recorder#readme"
            target="_blank"
            rel="noreferrer"
          >
            docs
          </a>
        </small>
      </footer>
    </main>
  );
}
