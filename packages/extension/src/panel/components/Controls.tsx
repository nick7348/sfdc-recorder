interface Props {
  isRecording: boolean;
  isPaused: boolean;
  isAsserting: boolean;
  canExport: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onToggleAssert: () => void;
  onExport: () => void;
}

export function Controls(props: Props): JSX.Element {
  const { isRecording, isPaused, isAsserting } = props;
  return (
    <div className="controls">
      {!isRecording && (
        <button className="primary" onClick={props.onStart}>
          ● Start recording
        </button>
      )}
      {isRecording && !isPaused && !isAsserting && (
        <button className="warn" onClick={props.onPause}>
          ❚❚ Pause
        </button>
      )}
      {isRecording && isPaused && (
        <button className="primary" onClick={props.onResume}>
          ▶ Resume
        </button>
      )}
      {isRecording && !isPaused && (
        <button
          className={isAsserting ? 'assert-active' : ''}
          title="Click an element to record an assertion (visible by default)"
          onClick={props.onToggleAssert}
        >
          {isAsserting ? '✓ Asserting' : '✓ Assert mode'}
        </button>
      )}
      {isRecording && (
        <button className="danger" onClick={props.onStop}>
          ■ Stop
        </button>
      )}
      <button disabled={!props.canExport} onClick={props.onExport}>
        ⬇ Export JSON
      </button>
    </div>
  );
}
