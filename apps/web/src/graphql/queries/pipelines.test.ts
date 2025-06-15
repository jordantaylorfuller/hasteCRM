import {
  GET_PIPELINES,
  GET_PIPELINE,
  GET_DEALS,
  GET_PIPELINE_METRICS,
} from "./pipelines";

describe("Pipeline Queries", () => {
  describe("GET_PIPELINES", () => {
    it("should be a valid GraphQL document", () => {
      expect(GET_PIPELINES).toBeDefined();
      expect(GET_PIPELINES.kind).toBe("Document");
      expect(GET_PIPELINES.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = GET_PIPELINES.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("query");
        expect(operation.name?.value).toBe("GetPipelines");
      }
    });

    it("should have no variable definitions", () => {
      const operation = GET_PIPELINES.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions?.length).toBe(0);
      }
    });

    it("should query for all required fields including nested stages and count", () => {
      const operation = GET_PIPELINES.definitions[0];
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
            "name",
            "type",
            "color",
            "order",
            "stages",
            "_count",
          ]);

          // Check stages nested fields
          const stagesField = selection.selectionSet.selections.find(
            (field) => field.kind === "Field" && field.name.value === "stages"
          );
          if (stagesField?.kind === "Field" && stagesField.selectionSet) {
            const stageFields = stagesField.selectionSet.selections.map((field) => {
              if (field.kind === "Field") {
                return field.name.value;
              }
            });
            expect(stageFields).toEqual([
              "id",
              "name",
              "order",
              "color",
              "probability",
            ]);
          }

          // Check _count nested fields
          const countField = selection.selectionSet.selections.find(
            (field) => field.kind === "Field" && field.name.value === "_count"
          );
          if (countField?.kind === "Field" && countField.selectionSet) {
            const countFields = countField.selectionSet.selections.map((field) => {
              if (field.kind === "Field") {
                return field.name.value;
              }
            });
            expect(countFields).toEqual(["deals"]);
          }
        }
      }
    });
  });

  describe("GET_PIPELINE", () => {
    it("should be a valid GraphQL document", () => {
      expect(GET_PIPELINE).toBeDefined();
      expect(GET_PIPELINE.kind).toBe("Document");
      expect(GET_PIPELINE.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = GET_PIPELINE.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("query");
        expect(operation.name?.value).toBe("GetPipeline");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = GET_PIPELINE.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("id");
          if (variable.type.kind === "NonNullType" && variable.type.type.kind === "NamedType") {
            expect(variable.type.type.name.value).toBe("ID");
          }
        }
      }
    });

    it("should query for same fields as GET_PIPELINES", () => {
      const operation = GET_PIPELINE.definitions[0];
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
            "name",
            "type",
            "color",
            "order",
            "stages",
            "_count",
          ]);
        }
      }
    });
  });

  describe("GET_DEALS", () => {
    it("should be a valid GraphQL document", () => {
      expect(GET_DEALS).toBeDefined();
      expect(GET_DEALS.kind).toBe("Document");
      expect(GET_DEALS.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = GET_DEALS.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("query");
        expect(operation.name?.value).toBe("GetDeals");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = GET_DEALS.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(6);
        
        const variables = operation.variableDefinitions?.map((v) => {
          if (v.kind === "VariableDefinition") {
            return {
              name: v.variable.name.value,
              type: v.type.kind === "NamedType" ? v.type.name.value : null,
            };
          }
        });

        expect(variables).toEqual([
          { name: "pipelineId", type: "ID" },
          { name: "stageId", type: "ID" },
          { name: "status", type: "String" },
          { name: "ownerId", type: "ID" },
          { name: "skip", type: "Int" },
          { name: "take", type: "Int" },
        ]);
      }
    });

    it("should query for all required fields including nested objects", () => {
      const operation = GET_DEALS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["deals", "total", "hasMore"]);

          // Check deals nested fields
          const dealsField = selection.selectionSet.selections.find(
            (field) => field.kind === "Field" && field.name.value === "deals"
          );
          if (dealsField?.kind === "Field" && dealsField.selectionSet) {
            const dealFields = dealsField.selectionSet.selections.map((field) => {
              if (field.kind === "Field") {
                return field.name.value;
              }
            });
            expect(dealFields).toContain("id");
            expect(dealFields).toContain("title");
            expect(dealFields).toContain("value");
            expect(dealFields).toContain("owner");
            expect(dealFields).toContain("company");
            expect(dealFields).toContain("contacts");
            expect(dealFields).toContain("_count");

            // Check nested owner fields
            const ownerField = dealsField.selectionSet.selections.find(
              (field) => field.kind === "Field" && field.name.value === "owner"
            );
            if (ownerField?.kind === "Field" && ownerField.selectionSet) {
              const ownerFields = ownerField.selectionSet.selections.map((field) => {
                if (field.kind === "Field") {
                  return field.name.value;
                }
              });
              expect(ownerFields).toEqual(["id", "firstName", "lastName", "avatarUrl"]);
            }

            // Check nested company fields
            const companyField = dealsField.selectionSet.selections.find(
              (field) => field.kind === "Field" && field.name.value === "company"
            );
            if (companyField?.kind === "Field" && companyField.selectionSet) {
              const companyFields = companyField.selectionSet.selections.map((field) => {
                if (field.kind === "Field") {
                  return field.name.value;
                }
              });
              expect(companyFields).toEqual(["id", "name", "logoUrl"]);
            }

            // Check nested _count fields
            const countField = dealsField.selectionSet.selections.find(
              (field) => field.kind === "Field" && field.name.value === "_count"
            );
            if (countField?.kind === "Field" && countField.selectionSet) {
              const countFields = countField.selectionSet.selections.map((field) => {
                if (field.kind === "Field") {
                  return field.name.value;
                }
              });
              expect(countFields).toEqual(["activities", "tasks", "notes", "emails"]);
            }
          }
        }
      }
    });

    it("should have correct query field name and arguments", () => {
      const operation = GET_DEALS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const field = operation.selectionSet.selections[0];
        if (field.kind === "Field") {
          expect(field.name.value).toBe("deals");
          expect(field.arguments).toHaveLength(6);
          
          const argNames = field.arguments?.map((arg) => {
            if (arg.kind === "Argument") {
              return arg.name.value;
            }
          });
          expect(argNames).toEqual([
            "pipelineId",
            "stageId",
            "status",
            "ownerId",
            "skip",
            "take",
          ]);
        }
      }
    });
  });

  describe("GET_PIPELINE_METRICS", () => {
    it("should be a valid GraphQL document", () => {
      expect(GET_PIPELINE_METRICS).toBeDefined();
      expect(GET_PIPELINE_METRICS.kind).toBe("Document");
      expect(GET_PIPELINE_METRICS.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = GET_PIPELINE_METRICS.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("query");
        expect(operation.name?.value).toBe("GetPipelineMetrics");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = GET_PIPELINE_METRICS.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(3);
        
        const variables = operation.variableDefinitions?.map((v) => {
          if (v.kind === "VariableDefinition") {
            const isRequired = v.type.kind === "NonNullType";
            const typeName = isRequired 
              ? v.type.type.kind === "NamedType" ? v.type.type.name.value : null
              : v.type.kind === "NamedType" ? v.type.name.value : null;
            return {
              name: v.variable.name.value,
              type: typeName,
              required: isRequired,
            };
          }
        });

        expect(variables).toEqual([
          { name: "id", type: "ID", required: true },
          { name: "startDate", type: "DateTime", required: false },
          { name: "endDate", type: "DateTime", required: false },
        ]);
      }
    });

    it("should query for all metrics fields", () => {
      const operation = GET_PIPELINE_METRICS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["pipeline", "metrics", "stages"]);

          // Check pipeline nested fields
          const pipelineField = selection.selectionSet.selections.find(
            (field) => field.kind === "Field" && field.name.value === "pipeline"
          );
          if (pipelineField?.kind === "Field" && pipelineField.selectionSet) {
            const pipelineFields = pipelineField.selectionSet.selections.map((field) => {
              if (field.kind === "Field") {
                return field.name.value;
              }
            });
            expect(pipelineFields).toEqual(["id", "name"]);
          }

          // Check metrics nested fields
          const metricsField = selection.selectionSet.selections.find(
            (field) => field.kind === "Field" && field.name.value === "metrics"
          );
          if (metricsField?.kind === "Field" && metricsField.selectionSet) {
            const metricFields = metricsField.selectionSet.selections.map((field) => {
              if (field.kind === "Field") {
                return field.name.value;
              }
            });
            expect(metricFields).toEqual([
              "total",
              "won",
              "lost",
              "open",
              "conversionRate",
              "avgDealSize",
            ]);
          }

          // Check stages nested fields
          const stagesField = selection.selectionSet.selections.find(
            (field) => field.kind === "Field" && field.name.value === "stages"
          );
          if (stagesField?.kind === "Field" && stagesField.selectionSet) {
            const stageFields = stagesField.selectionSet.selections.map((field) => {
              if (field.kind === "Field") {
                return field.name.value;
              }
            });
            expect(stageFields).toEqual([
              "id",
              "name",
              "count",
              "value",
              "probability",
            ]);
          }
        }
      }
    });
  });

  describe("Integration with Apollo Client", () => {
    it("all queries should be compatible with Apollo Client", () => {
      const queries = [
        GET_PIPELINES,
        GET_PIPELINE,
        GET_DEALS,
        GET_PIPELINE_METRICS,
      ];

      queries.forEach((query) => {
        expect(() => {
          const hasValidDefinition = query.definitions[0].kind === "OperationDefinition";
          expect(hasValidDefinition).toBe(true);
        }).not.toThrow();
      });
    });

    it("all queries should have proper operation types", () => {
      const queries = [
        GET_PIPELINES,
        GET_PIPELINE,
        GET_DEALS,
        GET_PIPELINE_METRICS,
      ];

      queries.forEach((query) => {
        const operation = query.definitions[0];
        if (operation.kind === "OperationDefinition") {
          expect(operation.operation).toBe("query");
        }
      });
    });

    it("query names should match field names", () => {
      const queryFieldMap = [
        { query: GET_PIPELINES, fieldName: "pipelines" },
        { query: GET_PIPELINE, fieldName: "pipeline" },
        { query: GET_DEALS, fieldName: "deals" },
        { query: GET_PIPELINE_METRICS, fieldName: "pipelineMetrics" },
      ];

      queryFieldMap.forEach(({ query, fieldName }) => {
        const operation = query.definitions[0];
        if (operation.kind === "OperationDefinition" && operation.selectionSet) {
          const field = operation.selectionSet.selections[0];
          if (field.kind === "Field") {
            expect(field.name.value).toBe(fieldName);
          }
        }
      });
    });

    it("GET_DEALS should work with all optional variables", () => {
      const variables = {
        pipelineId: "test-pipeline-id",
        stageId: "test-stage-id",
        status: "open",
        ownerId: "test-owner-id",
        skip: 0,
        take: 20,
      };

      // This test ensures the query can be used with Apollo Client
      expect(() => {
        const query = GET_DEALS;
        const operation = query.definitions[0];
        if (operation.kind === "OperationDefinition") {
          // All variables are optional
          const allOptional = operation.variableDefinitions?.every((v) => {
            if (v.kind === "VariableDefinition") {
              return v.type.kind !== "NonNullType";
            }
          });
          expect(allOptional).toBe(true);
        }
      }).not.toThrow();
    });
  });
});