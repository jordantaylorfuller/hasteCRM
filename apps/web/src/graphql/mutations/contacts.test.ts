import {
  CREATE_CONTACT,
  UPDATE_CONTACT,
  DELETE_CONTACT,
  RESTORE_CONTACT,
  UPDATE_CONTACT_SCORE,
  IMPORT_CONTACTS,
  EXPORT_CONTACTS,
} from "./contacts";

describe("Contact Mutations", () => {
  describe("CREATE_CONTACT", () => {
    it("should be a valid GraphQL document", () => {
      expect(CREATE_CONTACT).toBeDefined();
      expect(CREATE_CONTACT.kind).toBe("Document");
      expect(CREATE_CONTACT.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = CREATE_CONTACT.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("CreateContact");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = CREATE_CONTACT.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("input");
          if (variable.type.kind === "NonNullType" && variable.type.type.kind === "NamedType") {
            expect(variable.type.type.name.value).toBe("CreateContactInput");
          }
        }
      }
    });

    it("should query for all required fields", () => {
      const operation = CREATE_CONTACT.definitions[0];
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
            "firstName",
            "lastName",
            "email",
            "phone",
            "title",
            "companyId",
          ]);
        }
      }
    });
  });

  describe("UPDATE_CONTACT", () => {
    it("should be a valid GraphQL document", () => {
      expect(UPDATE_CONTACT).toBeDefined();
      expect(UPDATE_CONTACT.kind).toBe("Document");
      expect(UPDATE_CONTACT.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = UPDATE_CONTACT.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("UpdateContact");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = UPDATE_CONTACT.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("input");
          if (variable.type.kind === "NonNullType" && variable.type.type.kind === "NamedType") {
            expect(variable.type.type.name.value).toBe("UpdateContactInput");
          }
        }
      }
    });

    it("should query for all required fields", () => {
      const operation = UPDATE_CONTACT.definitions[0];
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
            "firstName",
            "lastName",
            "email",
            "phone",
            "title",
            "companyId",
          ]);
        }
      }
    });
  });

  describe("DELETE_CONTACT", () => {
    it("should be a valid GraphQL document", () => {
      expect(DELETE_CONTACT).toBeDefined();
      expect(DELETE_CONTACT.kind).toBe("Document");
      expect(DELETE_CONTACT.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = DELETE_CONTACT.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("RemoveContact");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = DELETE_CONTACT.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("id");
          if (variable.type.kind === "NonNullType" && variable.type.type.kind === "NamedType") {
            expect(variable.type.type.name.value).toBe("String");
          }
        }
      }
    });

    it("should have correct mutation field name", () => {
      const operation = DELETE_CONTACT.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const field = operation.selectionSet.selections[0];
        if (field.kind === "Field") {
          expect(field.name.value).toBe("removeContact");
        }
      }
    });
  });

  describe("RESTORE_CONTACT", () => {
    it("should be a valid GraphQL document", () => {
      expect(RESTORE_CONTACT).toBeDefined();
      expect(RESTORE_CONTACT.kind).toBe("Document");
      expect(RESTORE_CONTACT.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = RESTORE_CONTACT.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("RestoreContact");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = RESTORE_CONTACT.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("id");
          if (variable.type.kind === "NonNullType" && variable.type.type.kind === "NamedType") {
            expect(variable.type.type.name.value).toBe("String");
          }
        }
      }
    });
  });

  describe("UPDATE_CONTACT_SCORE", () => {
    it("should be a valid GraphQL document", () => {
      expect(UPDATE_CONTACT_SCORE).toBeDefined();
      expect(UPDATE_CONTACT_SCORE.kind).toBe("Document");
      expect(UPDATE_CONTACT_SCORE.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = UPDATE_CONTACT_SCORE.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("UpdateContactScore");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = UPDATE_CONTACT_SCORE.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(2);
        
        const idVariable = operation.variableDefinitions?.[0];
        if (idVariable?.kind === "VariableDefinition") {
          expect(idVariable.variable.name.value).toBe("id");
          if (idVariable.type.kind === "NonNullType" && idVariable.type.type.kind === "NamedType") {
            expect(idVariable.type.type.name.value).toBe("String");
          }
        }

        const scoreVariable = operation.variableDefinitions?.[1];
        if (scoreVariable?.kind === "VariableDefinition") {
          expect(scoreVariable.variable.name.value).toBe("score");
          if (scoreVariable.type.kind === "NonNullType" && scoreVariable.type.type.kind === "NamedType") {
            expect(scoreVariable.type.type.name.value).toBe("Int");
          }
        }
      }
    });

    it("should query for score field", () => {
      const operation = UPDATE_CONTACT_SCORE.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["id", "score"]);
        }
      }
    });
  });

  describe("IMPORT_CONTACTS", () => {
    it("should be a valid GraphQL document", () => {
      expect(IMPORT_CONTACTS).toBeDefined();
      expect(IMPORT_CONTACTS.kind).toBe("Document");
      expect(IMPORT_CONTACTS.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = IMPORT_CONTACTS.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("ImportContacts");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = IMPORT_CONTACTS.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(2);
        
        const inputVariable = operation.variableDefinitions?.[0];
        if (inputVariable?.kind === "VariableDefinition") {
          expect(inputVariable.variable.name.value).toBe("input");
          if (inputVariable.type.kind === "NonNullType" && inputVariable.type.type.kind === "NamedType") {
            expect(inputVariable.type.type.name.value).toBe("ImportContactsInput");
          }
        }

        const fileVariable = operation.variableDefinitions?.[1];
        if (fileVariable?.kind === "VariableDefinition") {
          expect(fileVariable.variable.name.value).toBe("fileContent");
          if (fileVariable.type.kind === "NonNullType" && fileVariable.type.type.kind === "NamedType") {
            expect(fileVariable.type.type.name.value).toBe("String");
          }
        }
      }
    });

    it("should query for import result fields", () => {
      const operation = IMPORT_CONTACTS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual([
            "importId",
            "total",
            "processed",
            "success",
            "errors",
          ]);
        }
      }
    });
  });

  describe("EXPORT_CONTACTS", () => {
    it("should be a valid GraphQL document", () => {
      expect(EXPORT_CONTACTS).toBeDefined();
      expect(EXPORT_CONTACTS.kind).toBe("Document");
      expect(EXPORT_CONTACTS.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = EXPORT_CONTACTS.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("mutation");
        expect(operation.name?.value).toBe("ExportContacts");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = EXPORT_CONTACTS.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("input");
          // Note: This is optional (nullable)
          if (variable.type.kind === "NamedType") {
            expect(variable.type.name.value).toBe("ExportContactsInput");
          }
        }
      }
    });

    it("should query for export result fields", () => {
      const operation = EXPORT_CONTACTS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual([
            "exportId",
            "fileUrl",
            "rowCount",
            "format",
            "expiresAt",
          ]);
        }
      }
    });
  });

  describe("Integration with Apollo Client", () => {
    it("all mutations should be compatible with Apollo Client", () => {
      const mutations = [
        CREATE_CONTACT,
        UPDATE_CONTACT,
        DELETE_CONTACT,
        RESTORE_CONTACT,
        UPDATE_CONTACT_SCORE,
        IMPORT_CONTACTS,
        EXPORT_CONTACTS,
      ];

      mutations.forEach((mutation) => {
        expect(() => {
          const hasValidDefinition = mutation.definitions[0].kind === "OperationDefinition";
          expect(hasValidDefinition).toBe(true);
        }).not.toThrow();
      });
    });

    it("mutation names should match field names", () => {
      const mutationFieldMap = [
        { mutation: CREATE_CONTACT, fieldName: "createContact" },
        { mutation: UPDATE_CONTACT, fieldName: "updateContact" },
        { mutation: DELETE_CONTACT, fieldName: "removeContact" },
        { mutation: RESTORE_CONTACT, fieldName: "restoreContact" },
        { mutation: UPDATE_CONTACT_SCORE, fieldName: "updateContactScore" },
        { mutation: IMPORT_CONTACTS, fieldName: "importContacts" },
        { mutation: EXPORT_CONTACTS, fieldName: "exportContacts" },
      ];

      mutationFieldMap.forEach(({ mutation, fieldName }) => {
        const operation = mutation.definitions[0];
        if (operation.kind === "OperationDefinition" && operation.selectionSet) {
          const field = operation.selectionSet.selections[0];
          if (field.kind === "Field") {
            expect(field.name.value).toBe(fieldName);
          }
        }
      });
    });
  });
});