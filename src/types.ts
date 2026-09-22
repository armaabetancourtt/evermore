import type { TypeAnnotation } from "./ast.js";

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
      readonly kind: "None";
    }
  | {
      readonly kind: "Primitive";
      readonly name: PrimitiveTypeName;
    }
  | {
      readonly kind: "Named";
      readonly name: string;
    }
  | {
      readonly kind: "Generic";
      readonly name: string;
    }
  | {
      readonly kind: "Protocol";
      readonly name: string;
    }
  | {
      readonly kind: "List";
      readonly elementType: TypeRef;
    }
  | {
      readonly kind: "Optional";
      readonly valueType: TypeRef;
    };

export function typeRef(name: string): TypeRef {
  return isPrimitiveTypeName(name)
    ? { kind: "Primitive", name }
    : { kind: "Named", name };
}

export function typeRefFromAnnotation(
  annotation: TypeAnnotation,
  genericNames: ReadonlySet<string> = new Set(),
  protocolNames: ReadonlySet<string> = new Set(),
): TypeRef {
  switch (annotation.kind) {
    case "NamedTypeAnnotation":
      if (genericNames.has(annotation.name)) {
        return { kind: "Generic", name: annotation.name };
      }

      if (protocolNames.has(annotation.name)) {
        return { kind: "Protocol", name: annotation.name };
      }

      return typeRef(annotation.name);

    case "ListTypeAnnotation":
      return {
        kind: "List",
        elementType: typeRefFromAnnotation(
          annotation.elementType,
          genericNames,
          protocolNames,
        ),
      };

    case "OptionalTypeAnnotation":
      return {
        kind: "Optional",
        valueType: typeRefFromAnnotation(
          annotation.valueType,
          genericNames,
          protocolNames,
        ),
      };
  }
}

export function describeTypeRef(type: TypeRef): string {
  switch (type.kind) {
    case "None":
      return "none";
    case "Primitive":
    case "Named":
    case "Generic":
    case "Protocol":
      return type.name;
    case "List":
      return "list of " + describeTypeRef(type.elementType);
    case "Optional":
      return "optional " + describeTypeRef(type.valueType);
  }
}
