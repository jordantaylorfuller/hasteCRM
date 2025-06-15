export enum ContactStatus {
  ACTIVE = "ACTIVE", // eslint-disable-line no-unused-vars
  INACTIVE = "INACTIVE", // eslint-disable-line no-unused-vars
  ARCHIVED = "ARCHIVED", // eslint-disable-line no-unused-vars
}

export enum ContactSource {
  MANUAL = "MANUAL", // eslint-disable-line no-unused-vars
  IMPORT = "IMPORT", // eslint-disable-line no-unused-vars
  API = "API", // eslint-disable-line no-unused-vars
  GMAIL = "GMAIL", // eslint-disable-line no-unused-vars
  WEBHOOK = "WEBHOOK", // eslint-disable-line no-unused-vars
  ENRICHMENT = "ENRICHMENT", // eslint-disable-line no-unused-vars
}

export interface Contact {
  id: string;
  workspaceId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  avatarUrl?: string;
  bio?: string;
  website?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  timezone?: string;
  source: ContactSource;
  status: ContactStatus;
  score: number;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  companyId?: string;
  company?: Company;
}

export interface Company {
  id: string;
  name: string;
  domain?: string;
  website?: string;
  logoUrl?: string;
  industry?: string;
  size?: string;
}

export interface ContactFiltersInput {
  search?: string;
  status?: ContactStatus;
  source?: ContactSource;
  companyId?: string;
  tags?: string[];
  city?: string;
  state?: string;
  country?: string;
}

export interface CreateContactInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  companyId?: string;
  bio?: string;
  website?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  timezone?: string;
}

export interface UpdateContactInput extends CreateContactInput {
  id: string;
}
