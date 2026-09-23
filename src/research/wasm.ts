import type {
  IRExpression,
  IRFunction,
  IRProgram,
} from "../ir.js";

export type NumericWasmModule = {
  readonly bytes: Uint8Array;
  readonly exports: readonly string[];
};

export function emitNumericWasm(program: IRProgram): NumericWasmModule {
  const functions = program.functions.filter(isEligibleNumericFunction);

  if (functions.length === 0) {
    throw new Error(
      "The wasm research target requires at least one pure numeric function with a single return expression.",
    );
  }

  const typeEntries = functions.flatMap((fn) => [
    0x60,
    ...uleb(fn.parameters.length),
    ...fn.parameters.map(() => 0x7c),
    0x01,
    0x7c,
  ]);

  const typeSection = section(1, [
    ...uleb(functions.length),
    ...typeEntries,
  ]);

  const functionSection = section(3, [
    ...uleb(functions.length),
    ...functions.flatMap((_, index) => uleb(index)),
  ]);

  const exportEntries = functions.flatMap((fn, index) => [
    ...nameBytes(fn.name),
    0x00,
    ...uleb(index),
  ]);

  const exportSection = section(7, [
    ...uleb(functions.length),
    ...exportEntries,
  ]);

  const codeEntries = functions.flatMap((fn) => {
    const expression = fn.body[0];
    if (!expression || expression.kind !== "Return") {
      throw new Error("Internal wasm eligibility mismatch.");
    }
    const parameterIndex = new Map(
      fn.parameters.map((parameter, index) => [
        parameter.name,
        index,
      ]),
    );
    const body = [
      0x00,
      ...emitExpression(expression.expression, parameterIndex),
      0x0b,
    ];
    return [...uleb(body.length), ...body];
  });

  const codeSection = section(10, [
    ...uleb(functions.length),
    ...codeEntries,
  ]);

  return {
    bytes: Uint8Array.from([
      0x00,
      0x61,
      0x73,
      0x6d,
      0x01,
      0x00,
      0x00,
      0x00,
      ...typeSection,
      ...functionSection,
      ...exportSection,
      ...codeSection,
    ]),
    exports: functions.map((fn) => fn.name),
  };
}

function isEligibleNumericFunction(fn: IRFunction): boolean {
  return (
    isNumberType(fn.returnType) &&
    fn.parameters.every((parameter) => isNumberType(parameter.type)) &&
    fn.body.length === 1 &&
    fn.body[0]?.kind === "Return" &&
    isNumericExpression(
      fn.body[0].expression,
      new Set(fn.parameters.map((parameter) => parameter.name)),
    )
  );
}

function isNumberType(
  type: IRFunction["returnType"],
): boolean {
  return type.kind === "Primitive" && type.name === "number";
}

function isNumericExpression(
  expression: IRExpression,
  parameters: ReadonlySet<string>,
): boolean {
  switch (expression.kind) {
    case "Number":
      return true;
    case "Identifier":
      return parameters.has(expression.name);
    case "Binary":
      return (
        ["+", "-", "*", "/"].includes(expression.operator) &&
        isNumericExpression(expression.left, parameters) &&
        isNumericExpression(expression.right, parameters)
      );
    default:
      return false;
  }
}

function emitExpression(
  expression: IRExpression,
  parameters: ReadonlyMap<string, number>,
): number[] {
  switch (expression.kind) {
    case "Number":
      return [0x44, ...f64(expression.value)];

    case "Identifier": {
      const index = parameters.get(expression.name);
      if (index === undefined) {
        throw new Error(
          "Unknown numeric wasm parameter " + expression.name + ".",
        );
      }
      return [0x20, ...uleb(index)];
    }

    case "Binary": {
      const opcode =
        expression.operator === "+"
          ? 0xa0
          : expression.operator === "-"
            ? 0xa1
            : expression.operator === "*"
              ? 0xa2
              : expression.operator === "/"
                ? 0xa3
                : undefined;

      if (opcode === undefined) {
        throw new Error(
          "Unsupported wasm numeric operator " +
            expression.operator +
            ".",
        );
      }

      return [
        ...emitExpression(expression.left, parameters),
        ...emitExpression(expression.right, parameters),
        opcode,
      ];
    }

    default:
      throw new Error(
        "Unsupported expression in wasm research target: " +
          expression.kind,
      );
  }
}

function f64(value: number): number[] {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, value, true);
  return [...new Uint8Array(buffer)];
}

function nameBytes(value: string): number[] {
  const bytes = [...new TextEncoder().encode(value)];
  return [...uleb(bytes.length), ...bytes];
}

function section(id: number, payload: readonly number[]): number[] {
  return [id, ...uleb(payload.length), ...payload];
}

function uleb(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value >>> 0;

  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining !== 0);

  return bytes;
}
