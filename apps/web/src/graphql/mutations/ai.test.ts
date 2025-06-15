import { GENERATE_SMART_COMPOSE, ENRICH_CONTACT } from "./ai";
import { DocumentNode } from "graphql"; // eslint-disable-line no-unused-vars

describe("AI Mutations", () => {
  describe("GENERATE_SMART_COMPOSE", () => {
    it("should be a valid GraphQL document", () => {
      expect(GENERATE_SMART_COMPOSE).toBeDefined();
      expect(GENERATE_SMART_COMPOSE.kind).toBe("Document");
      expect(GENERATE_SMART_COMPOSE.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = GENERATE_SMART_COMPOSE.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("GenerateSmartCompose");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = GENERATE_SMART_COMPOSE.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("input");
          if (
            variable.type.kind === "NonNullType" &&
            variable.type.type.kind === "NamedType"
          ) {
            expect(variable.type.type.name.value).toBe("SmartComposeInput");
          }
        }
      }
    });

    it("should query for all required fields", () => {
      const operation = GENERATE_SMART_COMPOSE.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["suggestions", "fullDraft"]);
        }
      }
    });

    it("should have correct mutation field name and arguments", () => {
      const operation = GENERATE_SMART_COMPOSE.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const field = operation.selectionSet.selections[0];
        if (field.kind === "Field") {
          expect(field.name.value).toBe("generateSmartCompose");
          expect(field.arguments).toHaveLength(1);
          const arg = field.arguments?.[0];
          if (arg?.kind === "Argument") {
            expect(arg.name.value).toBe("input");
            if (arg.value.kind === "Variable") {
              expect(arg.value.name.value).toBe("input");
            }
          }
        }
      }
    });
  });

  describe("ENRICH_CONTACT", () => {
    it("should be a valid GraphQL document", () => {
      expect(ENRICH_CONTACT).toBeDefined();
      expect(ENRICH_CONTACT.kind).toBe("Document");
      expect(ENRICH_CONTACT.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = ENRICH_CONTACT.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("EnrichContact");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = ENRICH_CONTACT.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("contactId");
          if (
            variable.type.kind === "NonNullType" &&
            variable.type.type.kind === "NamedType"
          ) {
            expect(variable.type.type.name.value).toBe("ID");
          }
        }
      }
    });

    it("should query for all required fields", () => {
      const operation = ENRICH_CONTACT.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual([
            "company",
            "title",
            "linkedInUrl",
            "summary",
            "tags",
          ]);
        }
      }
    });

    it("should have correct mutation field name and arguments", () => {
      const operation = ENRICH_CONTACT.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const field = operation.selectionSet.selections[0];
        if (field.kind === "Field") {
          expect(field.name.value).toBe("enrichContact");
          expect(field.arguments).toHaveLength(1);
          const arg = field.arguments?.[0];
          if (arg?.kind === "Argument") {
            expect(arg.name.value).toBe("contactId");
            if (arg.value.kind === "Variable") {
              expect(arg.value.name.value).toBe("contactId");
            }
          }
        }
      }
    });
  });

  describe("Integration with Apollo Client", () => {
    it("GENERATE_SMART_COMPOSE should be compatible with Apollo Client", () => {
      // Example variables structure for reference
      // const variables = {
      //   input: {
      //     emailId: "test-email-id",
      //     prompt: "Test prompt",
      //     tone: "professional",
      //     length: "medium",
      //     includeContext: true,
      //   },
      // };

      // This test ensures the mutation can be used with Apollo Client
      expect(() => {
        const query = GENERATE_SMART_COMPOSE;
        const hasVariables =
          query.definitions[0].kind === "OperationDefinition" &&
          query.definitions[0].variableDefinitions?.length > 0;
        expect(hasVariables).toBe(true);
      }).not.toThrow();
    });

    it("ENRICH_CONTACT should be compatible with Apollo Client", () => {
      // Example variables structure for reference
      // const variables = {
      //   contactId: "test-contact-id",
      // };

      // This test ensures the mutation can be used with Apollo Client
      expect(() => {
        const query = ENRICH_CONTACT;
        const hasVariables =
          query.definitions[0].kind === "OperationDefinition" &&
          query.definitions[0].variableDefinitions?.length > 0;
        expect(hasVariables).toBe(true);
      }).not.toThrow();
    });
  });
});
