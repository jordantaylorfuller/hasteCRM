import { gql } from "@apollo/client";

export const SUMMARIZE_EMAIL = gql`
  query SummarizeEmail($input: EmailSummarizationInput!) {
    summarizeEmail(input: $input) {
      summary
      actionItems
      keyPoints
    }
  }
`;

export const GET_AI_INSIGHTS = gql`
  query GetAiInsights($timeRange: InsightsTimeRangeInput!) {
    getAiInsights(timeRange: $timeRange) {
      communicationPatterns {
        totalEmails
        readRate
        starRate
        peakHours
        avgResponseTime
      }
      topContacts {
        id
        name
        email
        interactionCount
        lastInteraction
      }
      suggestions
    }
  }
`;
