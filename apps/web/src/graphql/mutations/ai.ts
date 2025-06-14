import { gql } from "@apollo/client";

export const GENERATE_SMART_COMPOSE = gql`
  mutation GenerateSmartCompose($input: SmartComposeInput!) {
    generateSmartCompose(input: $input) {
      suggestions
      fullDraft
    }
  }
`;

export const ENRICH_CONTACT = gql`
  mutation EnrichContact($contactId: ID!) {
    enrichContact(contactId: $contactId) {
      company
      title
      linkedInUrl
      summary
      tags
    }
  }
`;