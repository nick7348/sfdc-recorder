import type {
  ElementSnapshot,
  FramePathSegment,
  SalesforceContext,
  SalesforceFieldType,
} from '@sfdc-recorder/locator-engine';

export type ActionType =
  | 'click'
  | 'dblclick'
  | 'input'
  | 'change'
  | 'select'
  | 'press'
  | 'navigate'
  | 'waitFor'
  // v2 additions:
  | 'picklist'
  | 'multipicklist'
  | 'lookup'
  | 'combobox'
  | 'date'
  | 'datetime'
  | 'checkbox'
  | 'fileUpload'
  // assertions:
  | 'assertVisible'
  | 'assertHidden'
  | 'assertText'
  | 'assertValue'
  | 'assertUrl'
  | 'assertToast';

export interface RecordedAction_Click {
  type: 'click' | 'dblclick';
  snapshot: ElementSnapshot;
}

export interface RecordedAction_Input {
  type: 'input' | 'change' | 'select';
  snapshot: ElementSnapshot;
  value: string;
}

export interface RecordedAction_Press {
  type: 'press';
  snapshot: ElementSnapshot;
  key: string;
}

export interface RecordedAction_Navigate {
  type: 'navigate';
  url: string;
}

export interface RecordedAction_WaitFor {
  type: 'waitFor';
  reason: string;
}

/** Single-select picklist: open then click an option by label. */
export interface RecordedAction_Picklist {
  type: 'picklist';
  snapshot: ElementSnapshot;
  /** Label of the chosen option (display text). */
  optionLabel: string;
}

/** Multi-select picklist: choose N options. */
export interface RecordedAction_MultiPicklist {
  type: 'multipicklist';
  snapshot: ElementSnapshot;
  optionLabels: string[];
}

/** Lookup field: type to filter, then click the matching record row. */
export interface RecordedAction_Lookup {
  type: 'lookup';
  snapshot: ElementSnapshot;
  searchText: string;
  selectedRecord: string;
}

/** Lightning-combobox: same UI as picklist but distinguished here for codegen. */
export interface RecordedAction_Combobox {
  type: 'combobox';
  snapshot: ElementSnapshot;
  optionLabel: string;
}

export interface RecordedAction_Date {
  type: 'date' | 'datetime';
  snapshot: ElementSnapshot;
  /** ISO 8601 string (YYYY-MM-DD or YYYY-MM-DDTHH:mm). */
  isoValue: string;
}

export interface RecordedAction_Checkbox {
  type: 'checkbox';
  snapshot: ElementSnapshot;
  checked: boolean;
}

export interface RecordedAction_FileUpload {
  type: 'fileUpload';
  snapshot: ElementSnapshot;
  /** Files referenced by path. The runner needs them present at run time. */
  filePaths: string[];
}

/** Assertion variants. */
export interface RecordedAction_AssertVisible {
  type: 'assertVisible' | 'assertHidden';
  snapshot: ElementSnapshot;
}

export interface RecordedAction_AssertText {
  type: 'assertText';
  snapshot: ElementSnapshot;
  expected: string;
  /** match: 'exact' | 'contains' | 'regex' */
  match?: 'exact' | 'contains' | 'regex';
}

export interface RecordedAction_AssertValue {
  type: 'assertValue';
  snapshot: ElementSnapshot;
  expected: string;
}

export interface RecordedAction_AssertUrl {
  type: 'assertUrl';
  /** URL substring or pattern that must be present. */
  expected: string;
  match?: 'contains' | 'exact' | 'regex';
}

/** Assert a Salesforce toast appeared. */
export interface RecordedAction_AssertToast {
  type: 'assertToast';
  /** Either the toast text (any variant) or message + variant. */
  text?: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
}

export type RecordedAction =
  | RecordedAction_Click
  | RecordedAction_Input
  | RecordedAction_Press
  | RecordedAction_Navigate
  | RecordedAction_WaitFor
  | RecordedAction_Picklist
  | RecordedAction_MultiPicklist
  | RecordedAction_Lookup
  | RecordedAction_Combobox
  | RecordedAction_Date
  | RecordedAction_Checkbox
  | RecordedAction_FileUpload
  | RecordedAction_AssertVisible
  | RecordedAction_AssertText
  | RecordedAction_AssertValue
  | RecordedAction_AssertUrl
  | RecordedAction_AssertToast;

export interface RecordingStep {
  id: string;
  timestamp: number;
  action: RecordedAction;
  comment?: string;
  /** Sub-flow group this step belongs to. */
  groupId?: string;
}

/** Sub-flow group (named, reusable sequence of steps). */
export interface RecordingGroup {
  id: string;
  name: string;
  /** Optional description shown in generated code. */
  description?: string;
}

export interface Recording {
  /** Schema version. v1 = original; v2 = adds frames/fields/modals/assertions/groups. */
  version: 1 | 2;
  name: string;
  createdAt: string;
  startUrl: string;
  context: SalesforceContext;
  steps: RecordingStep[];
  /** v2: named groups (sub-flows) referenced by step.groupId. */
  groups?: RecordingGroup[];
  /** v2: declared variables ($VAR_NAME) used in step values; supplied at runtime via fixtures. */
  variables?: string[];
}

export interface CodegenOptions {
  /** TypeScript identifier for the test (e.g. "createAccount"). */
  testName?: string;
  /** Whether to insert a fallback locator chain comment for each step. */
  includeFallbackHints?: boolean;
  /** Insert `await waitForSalesforce(page)` after navigations. */
  insertSalesforceWaits?: boolean;
  /** Emit a function per group + a top-level test that calls them. */
  emitGroupsAsFunctions?: boolean;
  /** Emit a typed `Fixture` parameter and reference $VAR via fixture.VAR. */
  parameterizeFixtures?: boolean;
}

export type { ElementSnapshot, FramePathSegment, SalesforceContext, SalesforceFieldType };
