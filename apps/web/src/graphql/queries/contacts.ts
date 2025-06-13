import { gql } from "@apollo/client";

export const GET_CONTACTS = gql`
  query GetContacts($filters: ContactFiltersInput, $skip: Int, $take: Int) {
    contacts(filters: $filters, skip: $skip, take: $take) {
      contacts {
        id
        firstName
        lastName
        email
        phone
        title
        avatarUrl
        companyId
        source
        status
        score
        lastActivityAt
        createdAt
      }
      total
      hasMore
    }
  }
`;

export const GET_CONTACT = gql`
  query GetContact($id: String!) {
    contact(id: $id) {
      id
      firstName
      lastName
      email
      phone
      title
      avatarUrl
      bio
      website
      linkedinUrl
      twitterUrl
      facebookUrl
      address
      city
      state
      country
      postalCode
      timezone
      source
      status
      score
      lastActivityAt
      createdAt
      updatedAt
      companyId
    }
  }
`;

export const SEARCH_CONTACTS = gql`
  query SearchContacts(
    $query: String!
    $filters: ContactFiltersInput
    $skip: Int
    $take: Int
  ) {
    searchContacts(query: $query, filters: $filters, skip: $skip, take: $take) {
      contacts {
        id
        firstName
        lastName
        email
        phone
        title
        companyId
        score
      }
      total
      hasMore
    }
  }
`;
