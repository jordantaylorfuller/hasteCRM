import { gql } from "@apollo/client";

export const GET_PIPELINES = gql`
  query GetPipelines {
    pipelines {
      id
      name
      type
      color
      order
      stages {
        id
        name
        order
        color
        probability
      }
      _count {
        deals
      }
    }
  }
`;

export const GET_PIPELINE = gql`
  query GetPipeline($id: ID!) {
    pipeline(id: $id) {
      id
      name
      type
      color
      order
      stages {
        id
        name
        order
        color
        probability
      }
      _count {
        deals
      }
    }
  }
`;

export const GET_DEALS = gql`
  query GetDeals(
    $pipelineId: ID
    $stageId: ID
    $status: String
    $ownerId: ID
    $skip: Int
    $take: Int
  ) {
    deals(
      pipelineId: $pipelineId
      stageId: $stageId
      status: $status
      ownerId: $ownerId
      skip: $skip
      take: $take
    ) {
      deals {
        id
        title
        value
        currency
        probability
        closeDate
        status
        stageEnteredAt
        daysInStage
        owner {
          id
          firstName
          lastName
          avatarUrl
        }
        company {
          id
          name
          logoUrl
        }
        contacts {
          id
          firstName
          lastName
          email
        }
        _count {
          activities
          tasks
          notes
          emails
        }
      }
      total
      hasMore
    }
  }
`;

export const GET_PIPELINE_METRICS = gql`
  query GetPipelineMetrics($id: ID!, $startDate: DateTime, $endDate: DateTime) {
    pipelineMetrics(id: $id, startDate: $startDate, endDate: $endDate) {
      pipeline {
        id
        name
      }
      metrics {
        total
        won
        lost
        open
        conversionRate
        avgDealSize
      }
      stages {
        id
        name
        count
        value
        probability
      }
    }
  }
`;
