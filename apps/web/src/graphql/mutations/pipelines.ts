import { gql } from "@apollo/client";

export const CREATE_PIPELINE = gql`
  mutation CreatePipeline($input: CreatePipelineInput!) {
    createPipeline(input: $input) {
      id
      name
      type
      color
      stages {
        id
        name
        order
        color
        probability
      }
    }
  }
`;

export const UPDATE_PIPELINE = gql`
  mutation UpdatePipeline($id: ID!, $input: UpdatePipelineInput!) {
    updatePipeline(id: $id, input: $input) {
      id
      name
      color
      settings
    }
  }
`;

export const DELETE_PIPELINE = gql`
  mutation DeletePipeline($id: ID!) {
    deletePipeline(id: $id) {
      id
    }
  }
`;

export const CREATE_DEAL = gql`
  mutation CreateDeal($input: CreateDealInput!) {
    createDeal(input: $input) {
      id
      title
      value
      currency
      probability
      stage {
        id
        name
      }
      owner {
        id
        firstName
        lastName
      }
    }
  }
`;

export const UPDATE_DEAL = gql`
  mutation UpdateDeal($id: ID!, $input: UpdateDealInput!) {
    updateDeal(id: $id, input: $input) {
      id
      title
      value
      probability
      description
      closeDate
      status
    }
  }
`;

export const MOVE_DEAL = gql`
  mutation MoveDeal($input: MoveDealInput!) {
    moveDeal(input: $input) {
      id
      stage {
        id
        name
      }
      stageEnteredAt
    }
  }
`;

export const BULK_MOVE_DEALS = gql`
  mutation BulkMoveDeals($dealIds: [ID!]!, $stageId: ID!) {
    bulkMoveDeal(dealIds: $dealIds, stageId: $stageId) {
      id
      stage {
        id
      }
    }
  }
`;

export const DELETE_DEAL = gql`
  mutation DeleteDeal($id: ID!) {
    deleteDeal(id: $id) {
      id
    }
  }
`;
