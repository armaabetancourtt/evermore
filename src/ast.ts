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
  readonly data: readonly DataDeclaration[];
  readonly functions: readonly FunctionDeclaration[];
  readonly components: readonly ComponentDeclaration[];
  readonly screens: readonly ScreenDeclaration[];
  readonly span: SourceSpan;
};

export type DataDeclaration = {
  readonly kind: "DataDeclaration";
  readonly name: string;
  readonly fields: readonly DataField[];
  readonly span: SourceSpan;
};

export type DataField = {
  readonly name: string;
  readonly type: TypeAnnotation;
  readonly span: SourceSpan;
};

export type TypeAnnotation =
  | NamedTypeAnnotation
  | ListTypeAnnotation
  | OptionalTypeAnnotation;

export type NamedTypeAnnotation = {
  readonly kind: "NamedTypeAnnotation";
  readonly name: string;
  readonly span: SourceSpan;
};

export type ListTypeAnnotation = {
  readonly kind: "ListTypeAnnotation";
  readonly elementType: TypeAnnotation;
  readonly span: SourceSpan;
};

export type OptionalTypeAnnotation = {
  readonly kind: "OptionalTypeAnnotation";
  readonly valueType: TypeAnnotation;
  readonly span: SourceSpan;
};

export type FunctionDeclaration = {
  readonly kind: "FunctionDeclaration";
  readonly name: string;
  readonly parameters: readonly FunctionParameter[];
  readonly returnType: TypeAnnotation;
  readonly body: readonly FunctionStatement[];
  readonly span: SourceSpan;
};

export type FunctionParameter = {
  readonly name: string;
  readonly type: TypeAnnotation;
  readonly span: SourceSpan;
};

export type FunctionStatement = LetStatement | ReturnStatement;

export type LetStatement = {
  readonly kind: "LetStatement";
  readonly name: string;
  readonly expression: Expression;
  readonly span: SourceSpan;
};

export type ReturnStatement = {
  readonly kind: "ReturnStatement";
  readonly expression: Expression;
  readonly span: SourceSpan;
};

export type Expression =
  | NumberExpression
  | StringExpression
  | BooleanExpression
  | NoneExpression
  | ListExpression
  | IdentifierExpression
  | BinaryExpression
  | CallExpression;

export type NumberExpression = {
  readonly kind: "NumberExpression";
  readonly value: number;
  readonly span: SourceSpan;
};

export type StringExpression = {
  readonly kind: "StringExpression";
  readonly value: string;
  readonly span: SourceSpan;
};

export type BooleanExpression = {
  readonly kind: "BooleanExpression";
  readonly value: boolean;
  readonly span: SourceSpan;
};

export type NoneExpression = {
  readonly kind: "NoneExpression";
  readonly span: SourceSpan;
};

export type ListExpression = {
  readonly kind: "ListExpression";
  readonly elements: readonly Expression[];
  readonly span: SourceSpan;
};

export type IdentifierExpression = {
  readonly kind: "IdentifierExpression";
  readonly name: string;
  readonly span: SourceSpan;
};

export type BinaryOperator = "+" | "-" | "*" | "/";

export type BinaryExpression = {
  readonly kind: "BinaryExpression";
  readonly operator: BinaryOperator;
  readonly left: Expression;
  readonly right: Expression;
  readonly span: SourceSpan;
};

export type CallExpression = {
  readonly kind: "CallExpression";
  readonly callee: string;
  readonly arguments: readonly Expression[];
  readonly span: SourceSpan;
};

export type ComponentDeclaration = {
  readonly kind: "ComponentDeclaration";
  readonly name: string;
  readonly body: readonly VisualStatement[];
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
  | VisualStatement;

export type VisualStatement =
  | TextStatement
  | ShowStatement
  | ButtonStatement
  | StackStatement
  | UseStatement;

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

export type StackDirection = "vertical" | "horizontal";

export type StackStatement = {
  readonly kind: "StackStatement";
  readonly direction: StackDirection;
  readonly body: readonly VisualStatement[];
  readonly span: SourceSpan;
};

export type UseStatement = {
  readonly kind: "UseStatement";
  readonly componentName: string;
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
