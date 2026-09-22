export type SourcePosition = {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
};

export type SourceSpan = {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
};

export type Program = {
  readonly kind: "Program";
  readonly appName: string;
  readonly screens: readonly ScreenDeclaration[];
  readonly span: SourceSpan;
};

export type ScreenDeclaration = {
  readonly kind: "ScreenDeclaration";
  readonly name: string;
  readonly body: readonly ScreenStatement[];
  readonly span: SourceSpan;
};

export type ScreenStatement =
  | StateDeclaration
  | TitleStatement
  | TextStatement
  | ShowStatement
  | ButtonStatement;

export type StateDeclaration = {
  readonly kind: "StateDeclaration";
  readonly name: string;
  readonly initialValue: number;
  readonly span: SourceSpan;
};

export type TitleStatement = {
  readonly kind: "TitleStatement";
  readonly text: string;
  readonly span: SourceSpan;
};

export type TextStatement = {
  readonly kind: "TextStatement";
  readonly text: string;
  readonly span: SourceSpan;
};

export type ShowStatement = {
  readonly kind: "ShowStatement";
  readonly stateName: string;
  readonly span: SourceSpan;
};

export type ButtonStatement = {
  readonly kind: "ButtonStatement";
  readonly label: string;
  readonly action?: ButtonAction;
  readonly span: SourceSpan;
};

export type ButtonAction = NavigationAction | IncrementAction;

export type NavigationAction = {
  readonly kind: "NavigationAction";
  readonly target: string;
  readonly span: SourceSpan;
};

export type IncrementAction = {
  readonly kind: "IncrementAction";
  readonly stateName: string;
  readonly amount: number;
  readonly span: SourceSpan;
};
