import {
  CREATE_PIPELINE,
  UPDATE_PIPELINE,
  DELETE_PIPELINE,
  CREATE_DEAL,
  UPDATE_DEAL,
  MOVE_DEAL,
  BULK_MOVE_DEALS,
  DELETE_DEAL,
} from "./pipelines";

describe("Pipeline Mutations", () => {
  describe("CREATE_PIPELINE", () => {
    it("should be a valid GraphQL document", () => {
      expect(CREATE_PIPELINE).toBeDefined();
      expect(CREATE_PIPELINE.kind).toBe("Document");
      expect(CREATE_PIPELINE.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = CREATE_PIPELINE.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("CreatePipeline");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = CREATE_PIPELINE.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("input");
          if (
            variable.type.kind === "NonNullType" &&
            variable.type.type.kind === "NamedType"
          ) {
            expect(variable.type.type.name.value).toBe("CreatePipelineInput");
          }
        }
      }
    });

    it("should query for all required fields including nested stages", () => {
      const operation = CREATE_PIPELINE.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["id", "name", "type", "color", "stages"]);

          // Check stages nested fields
          const stagesField = selection.selectionSet.selections.find(
            (field) => field.kind === "Field" && field.name.value === "stages",
          );
          if (stagesField?.kind === "Field" && stagesField.selectionSet) {
            const stageFields = stagesField.selectionSet.selections.map(
              (field) => {
                if (field.kind === "Field") {
                  return field.name.value;
                }
              },
            );
            expect(stageFields).toEqual([
              "id",
              "name",
              "order",
              "color",
              "probability",
            ]);
          }
        }
      }
    });
  });

  describe("UPDATE_PIPELINE", () => {
    it("should be a valid GraphQL document", () => {
      expect(UPDATE_PIPELINE).toBeDefined();
      expect(UPDATE_PIPELINE.kind).toBe("Document");
      expect(UPDATE_PIPELINE.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = UPDATE_PIPELINE.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("UpdatePipeline");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = UPDATE_PIPELINE.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(2);

        const idVariable = operation.variableDefinitions?.[0];
        if (idVariable?.kind === "VariableDefinition") {
          expect(idVariable.variable.name.value).toBe("id");
          if (
            idVariable.type.kind === "NonNullType" &&
            idVariable.type.type.kind === "NamedType"
          ) {
            expect(idVariable.type.type.name.value).toBe("ID");
          }
        }

        const inputVariable = operation.variableDefinitions?.[1];
        if (inputVariable?.kind === "VariableDefinition") {
          expect(inputVariable.variable.name.value).toBe("input");
          if (
            inputVariable.type.kind === "NonNullType" &&
            inputVariable.type.type.kind === "NamedType"
          ) {
            expect(inputVariable.type.type.name.value).toBe(
              "UpdatePipelineInput",
            );
          }
        }
      }
    });
  });

  describe("DELETE_PIPELINE", () => {
    it("should be a valid GraphQL document", () => {
      expect(DELETE_PIPELINE).toBeDefined();
      expect(DELETE_PIPELINE.kind).toBe("Document");
      expect(DELETE_PIPELINE.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = DELETE_PIPELINE.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("DeletePipeline");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = DELETE_PIPELINE.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("id");
          if (
            variable.type.kind === "NonNullType" &&
            variable.type.type.kind === "NamedType"
          ) {
            expect(variable.type.type.name.value).toBe("ID");
          }
        }
      }
    });
  });

  describe("CREATE_DEAL", () => {
    it("should be a valid GraphQL document", () => {
      expect(CREATE_DEAL).toBeDefined();
      expect(CREATE_DEAL.kind).toBe("Document");
      expect(CREATE_DEAL.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = CREATE_DEAL.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("CreateDeal");
      }
    });

    it("should query for all required fields including nested objects", () => {
      const operation = CREATE_DEAL.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual([
            "id",
            "title",
            "value",
            "currency",
            "probability",
            "stage",
            "owner",
          ]);

          // Check nested fields
          const stageField = selection.selectionSet.selections.find(
            (field) => field.kind === "Field" && field.name.value === "stage",
          );
          if (stageField?.kind === "Field" && stageField.selectionSet) {
            const stageFields = stageField.selectionSet.selections.map(
              (field) => {
                if (field.kind === "Field") {
                  return field.name.value;
                }
              },
            );
            expect(stageFields).toEqual(["id", "name"]);
          }

          const ownerField = selection.selectionSet.selections.find(
            (field) => field.kind === "Field" && field.name.value === "owner",
          );
          if (ownerField?.kind === "Field" && ownerField.selectionSet) {
            const ownerFields = ownerField.selectionSet.selections.map(
              (field) => {
                if (field.kind === "Field") {
                  return field.name.value;
                }
              },
            );
            expect(ownerFields).toEqual(["id", "firstName", "lastName"]);
          }
        }
      }
    });
  });

  describe("UPDATE_DEAL", () => {
    it("should be a valid GraphQL document", () => {
      expect(UPDATE_DEAL).toBeDefined();
      expect(UPDATE_DEAL.kind).toBe("Document");
      expect(UPDATE_DEAL.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = UPDATE_DEAL.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("UpdateDeal");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = UPDATE_DEAL.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(2);

        const idVariable = operation.variableDefinitions?.[0];
        if (idVariable?.kind === "VariableDefinition") {
          expect(idVariable.variable.name.value).toBe("id");
          if (
            idVariable.type.kind === "NonNullType" &&
            idVariable.type.type.kind === "NamedType"
          ) {
            expect(idVariable.type.type.name.value).toBe("ID");
          }
        }

        const inputVariable = operation.variableDefinitions?.[1];
        if (inputVariable?.kind === "VariableDefinition") {
          expect(inputVariable.variable.name.value).toBe("input");
          if (
            inputVariable.type.kind === "NonNullType" &&
            inputVariable.type.type.kind === "NamedType"
          ) {
            expect(inputVariable.type.type.name.value).toBe("UpdateDealInput");
          }
        }
      }
    });

    it("should query for all updated fields", () => {
      const operation = UPDATE_DEAL.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual([
            "id",
            "title",
            "value",
            "probability",
            "description",
            "closeDate",
            "status",
          ]);
        }
      }
    });
  });

  describe("MOVE_DEAL", () => {
    it("should be a valid GraphQL document", () => {
      expect(MOVE_DEAL).toBeDefined();
      expect(MOVE_DEAL.kind).toBe("Document");
      expect(MOVE_DEAL.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = MOVE_DEAL.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("MoveDeal");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = MOVE_DEAL.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("input");
          if (
            variable.type.kind === "NonNullType" &&
            variable.type.type.kind === "NamedType"
          ) {
            expect(variable.type.type.name.value).toBe("MoveDealInput");
          }
        }
      }
    });

    it("should query for move result fields", () => {
      const operation = MOVE_DEAL.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["id", "stage", "stageEnteredAt"]);

          // Check stage nested fields
          const stageField = selection.selectionSet.selections.find(
            (field) => field.kind === "Field" && field.name.value === "stage",
          );
          if (stageField?.kind === "Field" && stageField.selectionSet) {
            const stageFields = stageField.selectionSet.selections.map(
              (field) => {
                if (field.kind === "Field") {
                  return field.name.value;
                }
              },
            );
            expect(stageFields).toEqual(["id", "name"]);
          }
        }
      }
    });
  });

  describe("BULK_MOVE_DEALS", () => {
    it("should be a valid GraphQL document", () => {
      expect(BULK_MOVE_DEALS).toBeDefined();
      expect(BULK_MOVE_DEALS.kind).toBe("Document");
      expect(BULK_MOVE_DEALS.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = BULK_MOVE_DEALS.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("BulkMoveDeals");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = BULK_MOVE_DEALS.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(2);

        const dealIdsVariable = operation.variableDefinitions?.[0];
        if (dealIdsVariable?.kind === "VariableDefinition") {
          expect(dealIdsVariable.variable.name.value).toBe("dealIds");
          if (
            dealIdsVariable.type.kind === "NonNullType" &&
            dealIdsVariable.type.type.kind === "ListType" &&
            dealIdsVariable.type.type.type.kind === "NonNullType" &&
            dealIdsVariable.type.type.type.type.kind === "NamedType"
          ) {
            expect(dealIdsVariable.type.type.type.type.name.value).toBe("ID");
          }
        }

        const stageIdVariable = operation.variableDefinitions?.[1];
        if (stageIdVariable?.kind === "VariableDefinition") {
          expect(stageIdVariable.variable.name.value).toBe("stageId");
          if (
            stageIdVariable.type.kind === "NonNullType" &&
            stageIdVariable.type.type.kind === "NamedType"
          ) {
            expect(stageIdVariable.type.type.name.value).toBe("ID");
          }
        }
      }
    });

    it("should have correct mutation field name", () => {
      const operation = BULK_MOVE_DEALS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const field = operation.selectionSet.selections[0];
        if (field.kind === "Field") {
          expect(field.name.value).toBe("bulkMoveDeal");
        }
      }
    });
  });

  describe("DELETE_DEAL", () => {
    it("should be a valid GraphQL document", () => {
      expect(DELETE_DEAL).toBeDefined();
      expect(DELETE_DEAL.kind).toBe("Document");
      expect(DELETE_DEAL.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = DELETE_DEAL.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("DeleteDeal");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = DELETE_DEAL.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("id");
          if (
            variable.type.kind === "NonNullType" &&
            variable.type.type.kind === "NamedType"
          ) {
            expect(variable.type.type.name.value).toBe("ID");
          }
        }
      }
    });
  });

  describe("Integration with Apollo Client", () => {
    it("all mutations should be compatible with Apollo Client", () => {
      const mutations = [
        CREATE_PIPELINE,
        UPDATE_PIPELINE,
        DELETE_PIPELINE,
        CREATE_DEAL,
        UPDATE_DEAL,
        MOVE_DEAL,
        BULK_MOVE_DEALS,
        DELETE_DEAL,
      ];

      mutations.forEach((mutation) => {
        expect(() => {
          const hasValidDefinition =
            mutation.definitions[0].kind === "OperationDefinition";
          expect(hasValidDefinition).toBe(true);
        }).not.toThrow();
      });
    });

    it("mutation names should match field names", () => {
      const mutationFieldMap = [
        { mutation: CREATE_PIPELINE, fieldName: "createPipeline" },
        { mutation: UPDATE_PIPELINE, fieldName: "updatePipeline" },
        { mutation: DELETE_PIPELINE, fieldName: "deletePipeline" },
        { mutation: CREATE_DEAL, fieldName: "createDeal" },
        { mutation: UPDATE_DEAL, fieldName: "updateDeal" },
        { mutation: MOVE_DEAL, fieldName: "moveDeal" },
        { mutation: BULK_MOVE_DEALS, fieldName: "bulkMoveDeal" },
        { mutation: DELETE_DEAL, fieldName: "deleteDeal" },
      ];

      mutationFieldMap.forEach(({ mutation, fieldName }) => {
        const operation = mutation.definitions[0];
        if (
          operation.kind === "OperationDefinition" &&
          operation.selectionSet
        ) {
          const field = operation.selectionSet.selections[0];
          if (field.kind === "Field") {
            expect(field.name.value).toBe(fieldName);
          }
        }
      });
    });
  });
});
