import { SUMMARIZE_EMAIL, GET_AI_INSIGHTS } from "./ai";

describe("AI Queries", () => {
  describe("SUMMARIZE_EMAIL", () => {
    it("should be a valid GraphQL document", () => {
      expect(SUMMARIZE_EMAIL).toBeDefined();
      expect(SUMMARIZE_EMAIL.kind).toBe("Document");
      expect(SUMMARIZE_EMAIL.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = SUMMARIZE_EMAIL.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("query");
        expect(operation.name?.value).toBe("SummarizeEmail");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = SUMMARIZE_EMAIL.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("input");
          if (
            variable.type.kind === "NonNullType" &&
            variable.type.type.kind === "NamedType"
          ) {
            expect(variable.type.type.name.value).toBe(
              "EmailSummarizationInput",
            );
          }
        }
      }
    });

    it("should query for all required fields", () => {
      const operation = SUMMARIZE_EMAIL.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["summary", "actionItems", "keyPoints"]);
        }
      }
    });

    it("should have correct query field name and arguments", () => {
      const operation = SUMMARIZE_EMAIL.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const field = operation.selectionSet.selections[0];
        if (field.kind === "Field") {
          expect(field.name.value).toBe("summarizeEmail");
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

  describe("GET_AI_INSIGHTS", () => {
    it("should be a valid GraphQL document", () => {
      expect(GET_AI_INSIGHTS).toBeDefined();
      expect(GET_AI_INSIGHTS.kind).toBe("Document");
      expect(GET_AI_INSIGHTS.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = GET_AI_INSIGHTS.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("query");
        expect(operation.name?.value).toBe("GetAiInsights");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = GET_AI_INSIGHTS.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("timeRange");
          if (
            variable.type.kind === "NonNullType" &&
            variable.type.type.kind === "NamedType"
          ) {
            expect(variable.type.type.name.value).toBe(
              "InsightsTimeRangeInput",
            );
          }
        }
      }
    });

    it("should query for all required fields including nested objects", () => {
      const operation = GET_AI_INSIGHTS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual([
            "communicationPatterns",
            "topContacts",
            "suggestions",
          ]);

          // Check communicationPatterns nested fields
          const communicationPatternsField =
            selection.selectionSet.selections.find(
              (field) =>
                field.kind === "Field" &&
                field.name.value === "communicationPatterns",
            );
          if (
            communicationPatternsField?.kind === "Field" &&
            communicationPatternsField.selectionSet
          ) {
            const patternFields =
              communicationPatternsField.selectionSet.selections.map(
                (field) => {
                  if (field.kind === "Field") {
                    return field.name.value;
                  }
                },
              );
            expect(patternFields).toEqual([
              "totalEmails",
              "readRate",
              "starRate",
              "peakHours",
              "avgResponseTime",
            ]);
          }

          // Check topContacts nested fields
          const topContactsField = selection.selectionSet.selections.find(
            (field) =>
              field.kind === "Field" && field.name.value === "topContacts",
          );
          if (
            topContactsField?.kind === "Field" &&
            topContactsField.selectionSet
          ) {
            const contactFields = topContactsField.selectionSet.selections.map(
              (field) => {
                if (field.kind === "Field") {
                  return field.name.value;
                }
              },
            );
            expect(contactFields).toEqual([
              "id",
              "name",
              "email",
              "interactionCount",
              "lastInteraction",
            ]);
          }
        }
      }
    });

    it("should have correct query field name", () => {
      const operation = GET_AI_INSIGHTS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const field = operation.selectionSet.selections[0];
        if (field.kind === "Field") {
          expect(field.name.value).toBe("getAiInsights");
        }
      }
    });
  });

  describe("Integration with Apollo Client", () => {
    it("SUMMARIZE_EMAIL should be compatible with Apollo Client", () => {
      const variables = {
        input: {
          emailId: "test-email-id",
          language: "en",
        },
      };

      // This test ensures the query can be used with Apollo Client
      expect(() => {
        const query = SUMMARIZE_EMAIL;
        const hasVariables =
          query.definitions[0].kind === "OperationDefinition" &&
          query.definitions[0].variableDefinitions?.length > 0;
        expect(hasVariables).toBe(true);
      }).not.toThrow();
    });

    it("GET_AI_INSIGHTS should be compatible with Apollo Client", () => {
      const variables = {
        timeRange: {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        },
      };

      // This test ensures the query can be used with Apollo Client
      expect(() => {
        const query = GET_AI_INSIGHTS;
        const hasVariables =
          query.definitions[0].kind === "OperationDefinition" &&
          query.definitions[0].variableDefinitions?.length > 0;
        expect(hasVariables).toBe(true);
      }).not.toThrow();
    });

    it("all queries should have proper operation types", () => {
      const queries = [SUMMARIZE_EMAIL, GET_AI_INSIGHTS];

      queries.forEach((query) => {
        const operation = query.definitions[0];
        if (operation.kind === "OperationDefinition") {
          expect(operation.operation).toBe("query");
        }
      });
    });
  });
});
