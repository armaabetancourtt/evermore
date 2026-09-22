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
      readonly constraint?: string;
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
      readonly kind: "Set";
      readonly elementType: TypeRef;
    }
  | {
      readonly kind: "Map";
      readonly keyType: TypeRef;
      readonly valueType: TypeRef;
    }
  | {
      readonly kind: "Result";
      readonly okType: TypeRef;
      readonly errorType: TypeRef;
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
  genericConstraints: ReadonlyMap<string, string> = new Map(),
): TypeRef {
  switch (annotation.kind) {
    case "NamedTypeAnnotation":
      if (genericNames.has(annotation.name)) {
        const constraint = genericConstraints.get(annotation.name);
        return {
          kind: "Generic",
          name: annotation.name,
          ...(constraint ? { constraint } : {}),
        };
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
          genericConstraints,
        ),
      };

    case "SetTypeAnnotation":
      return {
        kind: "Set",
        elementType: typeRefFromAnnotation(
          annotation.elementType,
          genericNames,
          protocolNames,
          genericConstraints,
        ),
      };

    case "MapTypeAnnotation":
      return {
        kind: "Map",
        keyType: typeRefFromAnnotation(
          annotation.keyType,
          genericNames,
          protocolNames,
          genericConstraints,
        ),
        valueType: typeRefFromAnnotation(
          annotation.valueType,
          genericNames,
          protocolNames,
          genericConstraints,
        ),
      };

    case "ResultTypeAnnotation":
      return {
        kind: "Result",
        okType: typeRefFromAnnotation(
          annotation.okType,
          genericNames,
          protocolNames,
          genericConstraints,
        ),
        errorType: typeRefFromAnnotation(
          annotation.errorType,
          genericNames,
          protocolNames,
          genericConstraints,
        ),
      };

    case "OptionalTypeAnnotation":
      return {
        kind: "Optional",
        valueType: typeRefFromAnnotation(
          annotation.valueType,
          genericNames,
          protocolNames,
          genericConstraints,
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
    case "Set":
      return "set of " + describeTypeRef(type.elementType);
    case "Map":
      return (
        "map of " +
        describeTypeRef(type.keyType) +
        " to " +
        describeTypeRef(type.valueType)
      );
    case "Result":
      return (
        "result of " +
        describeTypeRef(type.okType) +
        " error " +
        describeTypeRef(type.errorType)
      );
    case "Optional":
      return "optional " + describeTypeRef(type.valueType);
  }
}
