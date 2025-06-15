import { GET_CONTACTS, GET_CONTACT, SEARCH_CONTACTS } from "./contacts";

describe("Contact Queries", () => {
  describe("GET_CONTACTS", () => {
    it("should be a valid GraphQL document", () => {
      expect(GET_CONTACTS).toBeDefined();
      expect(GET_CONTACTS.kind).toBe("Document");
      expect(GET_CONTACTS.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = GET_CONTACTS.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("query");
        expect(operation.name?.value).toBe("GetContacts");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = GET_CONTACTS.definitions[0];
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
          { name: "filters", type: "ContactFiltersInput" },
          { name: "skip", type: "Int" },
          { name: "take", type: "Int" },
        ]);
      }
    });

    it("should query for all required fields including nested pagination", () => {
      const operation = GET_CONTACTS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["contacts", "total", "hasMore"]);

          // Check contacts nested fields
          const contactsField = selection.selectionSet.selections.find(
            (field) =>
              field.kind === "Field" && field.name.value === "contacts",
          );
          if (contactsField?.kind === "Field" && contactsField.selectionSet) {
            const contactFields = contactsField.selectionSet.selections.map(
              (field) => {
                if (field.kind === "Field") {
                  return field.name.value;
                }
              },
            );
            expect(contactFields).toEqual([
              "id",
              "firstName",
              "lastName",
              "email",
              "phone",
              "title",
              "avatarUrl",
              "companyId",
              "source",
              "status",
              "score",
              "lastActivityAt",
              "createdAt",
            ]);
          }
        }
      }
    });

    it("should have correct query field name and arguments", () => {
      const operation = GET_CONTACTS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const field = operation.selectionSet.selections[0];
        if (field.kind === "Field") {
          expect(field.name.value).toBe("contacts");
          expect(field.arguments).toHaveLength(3);

          const argNames = field.arguments?.map((arg) => {
            if (arg.kind === "Argument") {
              return arg.name.value;
            }
          });
          expect(argNames).toEqual(["filters", "skip", "take"]);
        }
      }
    });
  });

  describe("GET_CONTACT", () => {
    it("should be a valid GraphQL document", () => {
      expect(GET_CONTACT).toBeDefined();
      expect(GET_CONTACT.kind).toBe("Document");
      expect(GET_CONTACT.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = GET_CONTACT.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("query");
        expect(operation.name?.value).toBe("GetContact");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = GET_CONTACT.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(1);
        const variable = operation.variableDefinitions?.[0];
        if (variable?.kind === "VariableDefinition") {
          expect(variable.variable.name.value).toBe("id");
          if (
            variable.type.kind === "NonNullType" &&
            variable.type.type.kind === "NamedType"
          ) {
            expect(variable.type.type.name.value).toBe("String");
          }
        }
      }
    });

    it("should query for all contact detail fields", () => {
      const operation = GET_CONTACT.definitions[0];
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
            "avatarUrl",
            "bio",
            "website",
            "linkedinUrl",
            "twitterUrl",
            "facebookUrl",
            "address",
            "city",
            "state",
            "country",
            "postalCode",
            "timezone",
            "source",
            "status",
            "score",
            "lastActivityAt",
            "createdAt",
            "updatedAt",
            "companyId",
          ]);
        }
      }
    });

    it("should have correct query field name", () => {
      const operation = GET_CONTACT.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const field = operation.selectionSet.selections[0];
        if (field.kind === "Field") {
          expect(field.name.value).toBe("contact");
        }
      }
    });
  });

  describe("SEARCH_CONTACTS", () => {
    it("should be a valid GraphQL document", () => {
      expect(SEARCH_CONTACTS).toBeDefined();
      expect(SEARCH_CONTACTS.kind).toBe("Document");
      expect(SEARCH_CONTACTS.definitions).toHaveLength(1);
    });

    it("should have correct operation type and name", () => {
      const operation = SEARCH_CONTACTS.definitions[0];
      expect(operation.kind).toBe("OperationDefinition");
      if (operation.kind === "OperationDefinition") {
        expect(operation.operation).toBe("query");
        expect(operation.name?.value).toBe("SearchContacts");
      }
    });

    it("should have correct variable definitions", () => {
      const operation = SEARCH_CONTACTS.definitions[0];
      if (operation.kind === "OperationDefinition") {
        expect(operation.variableDefinitions).toHaveLength(4);

        const variables = operation.variableDefinitions?.map((v) => {
          if (v.kind === "VariableDefinition") {
            const isRequired = v.type.kind === "NonNullType";
            const typeName = isRequired
              ? v.type.type.kind === "NamedType"
                ? v.type.type.name.value
                : null
              : v.type.kind === "NamedType"
                ? v.type.name.value
                : null;
            return {
              name: v.variable.name.value,
              type: typeName,
              required: isRequired,
            };
          }
        });

        expect(variables).toEqual([
          { name: "query", type: "String", required: true },
          { name: "filters", type: "ContactFiltersInput", required: false },
          { name: "skip", type: "Int", required: false },
          { name: "take", type: "Int", required: false },
        ]);
      }
    });

    it("should query for search result fields", () => {
      const operation = SEARCH_CONTACTS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === "Field" && selection.selectionSet) {
          const fields = selection.selectionSet.selections.map((field) => {
            if (field.kind === "Field") {
              return field.name.value;
            }
          });
          expect(fields).toEqual(["contacts", "total", "hasMore"]);

          // Check contacts nested fields
          const contactsField = selection.selectionSet.selections.find(
            (field) =>
              field.kind === "Field" && field.name.value === "contacts",
          );
          if (contactsField?.kind === "Field" && contactsField.selectionSet) {
            const contactFields = contactsField.selectionSet.selections.map(
              (field) => {
                if (field.kind === "Field") {
                  return field.name.value;
                }
              },
            );
            expect(contactFields).toEqual([
              "id",
              "firstName",
              "lastName",
              "email",
              "phone",
              "title",
              "companyId",
              "score",
            ]);
          }
        }
      }
    });

    it("should have correct query field name and arguments", () => {
      const operation = SEARCH_CONTACTS.definitions[0];
      if (operation.kind === "OperationDefinition" && operation.selectionSet) {
        const field = operation.selectionSet.selections[0];
        if (field.kind === "Field") {
          expect(field.name.value).toBe("searchContacts");
          expect(field.arguments).toHaveLength(4);

          const argNames = field.arguments?.map((arg) => {
            if (arg.kind === "Argument") {
              return arg.name.value;
            }
          });
          expect(argNames).toEqual(["query", "filters", "skip", "take"]);
        }
      }
    });
  });

  describe("Integration with Apollo Client", () => {
    it("all queries should be compatible with Apollo Client", () => {
      const queries = [GET_CONTACTS, GET_CONTACT, SEARCH_CONTACTS];

      queries.forEach((query) => {
        expect(() => {
          const hasValidDefinition =
            query.definitions[0].kind === "OperationDefinition";
          expect(hasValidDefinition).toBe(true);
        }).not.toThrow();
      });
    });

    it("GET_CONTACTS should work with optional variables", () => {
      const variables = {
        filters: {
          status: "active",
          source: "manual",
        },
        skip: 0,
        take: 20,
      };

      // This test ensures the query can be used with Apollo Client
      expect(() => {
        const query = GET_CONTACTS;
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

    it("GET_CONTACT should require id variable", () => {
      const variables = {
        id: "test-contact-id",
      };

      // This test ensures the query can be used with Apollo Client
      expect(() => {
        const query = GET_CONTACT;
        const operation = query.definitions[0];
        if (operation.kind === "OperationDefinition") {
          const idVariable = operation.variableDefinitions?.[0];
          if (idVariable?.kind === "VariableDefinition") {
            expect(idVariable.type.kind).toBe("NonNullType");
          }
        }
      }).not.toThrow();
    });

    it("SEARCH_CONTACTS should require query variable but others optional", () => {
      const variables = {
        query: "john doe",
        filters: { status: "active" },
        skip: 0,
        take: 10,
      };

      // This test ensures the query can be used with Apollo Client
      expect(() => {
        const query = SEARCH_CONTACTS;
        const operation = query.definitions[0];
        if (operation.kind === "OperationDefinition") {
          const queryVariable = operation.variableDefinitions?.[0];
          if (queryVariable?.kind === "VariableDefinition") {
            expect(queryVariable.variable.name.value).toBe("query");
            expect(queryVariable.type.kind).toBe("NonNullType");
          }
        }
      }).not.toThrow();
    });
  });
});
