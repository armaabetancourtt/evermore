export const primitiveTypeNames = [
  "text",
  "number",
  "boolean",
  "id",
] as const;

export type PrimitiveTypeName = (typeof primitiveTypeNames)[number];

const primitiveTypes = new Set<string>(primitiveTypeNames);

export function isPrimitiveTypeName(
  name: string,
): name is PrimitiveTypeName {
  return primitiveTypes.has(name);
}

export type TypeRef =
  | {
      readonly kind: "Primitive";
      readonly name: PrimitiveTypeName;
    }
  | {
      readonly kind: "Named";
      readonly name: string;
    };

export function typeRef(name: string): TypeRef {
  return isPrimitiveTypeName(name)
    ? { kind: "Primitive", name }
    : { kind: "Named", name };
}
