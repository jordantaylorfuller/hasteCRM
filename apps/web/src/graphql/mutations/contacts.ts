import { gql } from "@apollo/client";

export const CREATE_CONTACT = gql`
  mutation CreateContact($input: CreateContactInput!) {
    createContact(input: $input) {
      id
      firstName
      lastName
      email
      phone
      title
      companyId
    }
  }
`;

export const UPDATE_CONTACT = gql`
  mutation UpdateContact($input: UpdateContactInput!) {
    updateContact(input: $input) {
      id
      firstName
      lastName
      email
      phone
      title
      companyId
    }
  }
`;

export const DELETE_CONTACT = gql`
  mutation RemoveContact($id: String!) {
    removeContact(id: $id) {
      id
    }
  }
`;

export const RESTORE_CONTACT = gql`
  mutation RestoreContact($id: String!) {
    restoreContact(id: $id) {
      id
    }
  }
`;

export const UPDATE_CONTACT_SCORE = gql`
  mutation UpdateContactScore($id: String!, $score: Int!) {
    updateContactScore(id: $id, score: $score) {
      id
      score
    }
  }
`;

export const IMPORT_CONTACTS = gql`
  mutation ImportContacts($input: ImportContactsInput!, $fileContent: String!) {
    importContacts(input: $input, fileContent: $fileContent) {
      importId
      total
      processed
      success
      errors
    }
  }
`;

export const EXPORT_CONTACTS = gql`
  mutation ExportContacts($input: ExportContactsInput) {
    exportContacts(input: $input) {
      exportId
      fileUrl
      rowCount
      format
      expiresAt
    }
  }
`;
