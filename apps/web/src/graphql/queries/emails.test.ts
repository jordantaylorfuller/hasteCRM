import {
  GET_EMAILS,
  GET_EMAIL_ACCOUNTS,
  SYNC_EMAILS,
  SEND_EMAIL,
  UPDATE_EMAIL,
} from "./emails";

describe("Email Queries and Mutations", () => {
  describe("GET_EMAILS", () => {
    it("should be a valid GraphQL document", () => {
      expect(GET_EMAILS).toBeDefined();
      expect(GET_EMAILS.kind).toBe("Document");
      expect(GET_EMAILS.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = GET_EMAILS.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("query");
        expect(operation.name?.value).toBe("GetEmails");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = GET_EMAILS.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(3);

        const variables = operation.variableDefinitions?.map((v) => {
          if (v.kind === "VariableDefinition") {
            return {
              name: v.variable.name.value,
              type: v.type.kind === "NamedType" ? v.type.name.value : null,
            };
          }
        });

        expect(variables).toEqual([
          { name: "filters", type: "EmailFilterInput" },
          { name: "limit", type: "Int" },
          { name: "offset", type: "Int" },
        ]);
      }
    });

    it("should query for all required fields including nested attachments", () => {
      const operation = GET_EMAILS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["items", "total", "hasMore"]);

          // Check items nested fields
          const itemsField = selection.selectionSet.selections.find(
            (field) => field.kind === "Field" && field.name.value === "items",
          );
          if (itemsField?.kind === "Field" && itemsField.selectionSet) {
            const emailFields = itemsField.selectionSet.selections.map(
              (field) => {
                if (field.kind === "Field") {
                  return field.name.value;
                }
              },
            );
            expect(emailFields).toContain("id");
            expect(emailFields).toContain("gmailId");
            expect(emailFields).toContain("subject");
            expect(emailFields).toContain("attachments");

            // Check attachments nested fields
            const attachmentsField = itemsField.selectionSet.selections.find(
              (field) =>
                field.kind === "Field" && field.name.value === "attachments",
            );
            if (
              attachmentsField?.kind === "Field" &&
              attachmentsField.selectionSet
            ) {
              const attachmentFields =
                attachmentsField.selectionSet.selections.map((field) => {
                  if (field.kind === "Field") {
                    return field.name.value;
                  }
                });
              expect(attachmentFields).toEqual([
                "id",
                "gmailId",
                "filename",
                "mimeType",
                "size",
              ]);
            }
          }
        }
      }
    });
  });

  describe("GET_EMAIL_ACCOUNTS", () => {
    it("should be a valid GraphQL document", () => {
      expect(GET_EMAIL_ACCOUNTS).toBeDefined();
      expect(GET_EMAIL_ACCOUNTS.kind).toBe("Document");
      expect(GET_EMAIL_ACCOUNTS.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = GET_EMAIL_ACCOUNTS.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("query");
        expect(operation.name?.value).toBe("GetEmailAccounts");
      }
    });

    it("should have no variable definitions", () => {
      const operation = GET_EMAIL_ACCOUNTS.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions?.length).toBe(0);
      }
    });

    it("should query for email account fields", () => {
      const operation = GET_EMAIL_ACCOUNTS.definitions[0];
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
            "email",
            "syncEnabled",
            "syncStatus",
            "lastSyncAt",
          ]);
        }
      }
    });
  });

  describe("SYNC_EMAILS", () => {
    it("should be a valid GraphQL document", () => {
      expect(SYNC_EMAILS).toBeDefined();
      expect(SYNC_EMAILS.kind).toBe("Document");
      expect(SYNC_EMAILS.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = SYNC_EMAILS.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("SyncEmails");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = SYNC_EMAILS.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("accountId");
          if (
            variable.type.kind === "NonNullType" &&
            variable.type.type.kind === "NamedType"
          ) {
            expect(variable.type.type.name.value).toBe("String");
          }
        }
      }
    });

    it("should query for sync result fields", () => {
      const operation = SYNC_EMAILS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["success", "message"]);
        }
      }
    });

    it("should have correct mutation field name", () => {
      const operation = SYNC_EMAILS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const field = operation.selectionSet.selections[0];
        if (field.kind === "Field") {
          expect(field.name.value).toBe("syncEmails");
        }
      }
    });
  });

  describe("SEND_EMAIL", () => {
    it("should be a valid GraphQL document", () => {
      expect(SEND_EMAIL).toBeDefined();
      expect(SEND_EMAIL.kind).toBe("Document");
      expect(SEND_EMAIL.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = SEND_EMAIL.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("SendEmail");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = SEND_EMAIL.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("input");
          if (
            variable.type.kind === "NonNullType" &&
            variable.type.type.kind === "NamedType"
          ) {
            expect(variable.type.type.name.value).toBe("SendEmailInput");
          }
        }
      }
    });

    it("should query for send result fields", () => {
      const operation = SEND_EMAIL.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["id", "gmailId"]);
        }
      }
    });
  });

  describe("UPDATE_EMAIL", () => {
    it("should be a valid GraphQL document", () => {
      expect(UPDATE_EMAIL).toBeDefined();
      expect(UPDATE_EMAIL.kind).toBe("Document");
      expect(UPDATE_EMAIL.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = UPDATE_EMAIL.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("UpdateEmail");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = UPDATE_EMAIL.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(2);

        const idVariable = operation.variableDefinitions?.[0];
        if (idVariable?.kind === "VariableDefinition") {
          expect(idVariable.variable.name.value).toBe("id");
          if (
            idVariable.type.kind === "NonNullType" &&
            idVariable.type.type.kind === "NamedType"
          ) {
            expect(idVariable.type.type.name.value).toBe("String");
          }
        }

        const inputVariable = operation.variableDefinitions?.[1];
        if (inputVariable?.kind === "VariableDefinition") {
          expect(inputVariable.variable.name.value).toBe("input");
          if (
            inputVariable.type.kind === "NonNullType" &&
            inputVariable.type.type.kind === "NamedType"
          ) {
            expect(inputVariable.type.type.name.value).toBe("UpdateEmailInput");
          }
        }
      }
    });

    it("should query for update result fields", () => {
      const operation = UPDATE_EMAIL.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["id", "isRead", "isStarred", "gmailLabels"]);
        }
      }
    });
  });

  describe("Integration with Apollo Client", () => {
    it("all operations should be compatible with Apollo Client", () => {
      const operations = [
        GET_EMAILS,
        GET_EMAIL_ACCOUNTS,
        SYNC_EMAILS,
        SEND_EMAIL,
        UPDATE_EMAIL,
      ];

      operations.forEach((operation) => {
        expect(() => {
          const hasValidDefinition =
            operation.definitions[0].kind === "OperationDefinition";
          expect(hasValidDefinition).toBe(true);
        }).not.toThrow();
      });
    });

    it("queries and mutations should have correct operation types", () => {
      const queries = [GET_EMAILS, GET_EMAIL_ACCOUNTS];
      const mutations = [SYNC_EMAILS, SEND_EMAIL, UPDATE_EMAIL];

      queries.forEach((query) => {
        const operation = query.definitions[0];
        if (operation.kind === "OperationDefinition") {
          expect(operation.operation).toBe("query");
        }
      });

      mutations.forEach((mutation) => {
        const operation = mutation.definitions[0];
        if (operation.kind === "OperationDefinition") {
          expect(operation.operation).toBe("mutation");
        }
      });
    });

    it("operation names should match field names", () => {
      const operationFieldMap = [
        { operation: GET_EMAILS, fieldName: "emails" },
        { operation: GET_EMAIL_ACCOUNTS, fieldName: "emailAccounts" },
        { operation: SYNC_EMAILS, fieldName: "syncEmails" },
        { operation: SEND_EMAIL, fieldName: "sendEmail" },
        { operation: UPDATE_EMAIL, fieldName: "updateEmail" },
      ];

      operationFieldMap.forEach(({ operation, fieldName }) => {
        const def = operation.definitions[0];
        if (def.kind === "OperationDefinition" && def.selectionSet) {
          const field = def.selectionSet.selections[0];
          if (field.kind === "Field") {
            expect(field.name.value).toBe(fieldName);
          }
        }
      });
    });
  });
});
