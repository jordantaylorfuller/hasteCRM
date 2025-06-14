import { gql } from "@apollo/client";

export const GET_EMAILS = gql`
  query GetEmails($filters: EmailFilterInput, $limit: Int, $offset: Int) {
    emails(filters: $filters, limit: $limit, offset: $offset) {
      items {
        id
        gmailId
        threadId
        fromEmail
        fromName
        toEmails
        ccEmails
        bccEmails
        subject
        snippet
        bodyText
        bodyHtml
        sentAt
        receivedAt
        isRead
        isStarred
        gmailLabels
        attachments {
          id
          gmailId
          filename
          mimeType
          size
        }
      }
      total
      hasMore
    }
  }
`;

export const GET_EMAIL_ACCOUNTS = gql`
  query GetEmailAccounts {
    emailAccounts {
      id
      email
      syncEnabled
      syncStatus
      lastSyncAt
    }
  }
`;

export const SYNC_EMAILS = gql`
  mutation SyncEmails($accountId: String!) {
    syncEmails(accountId: $accountId) {
      success
      message
    }
  }
`;

export const SEND_EMAIL = gql`
  mutation SendEmail($input: SendEmailInput!) {
    sendEmail(input: $input) {
      id
      gmailId
    }
  }
`;

export const UPDATE_EMAIL = gql`
  mutation UpdateEmail($id: String!, $input: UpdateEmailInput!) {
    updateEmail(id: $id, input: $input) {
      id
      isRead
      isStarred
      gmailLabels
    }
  }
`;
