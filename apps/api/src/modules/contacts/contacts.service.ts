import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateContactInput } from "./dto/create-contact.input";
import { UpdateContactInput } from "./dto/update-contact.input";
import { ContactFiltersInput } from "./dto/contact-filters.input";
import { ContactStatus, Prisma, Contact, Tag } from "../prisma/prisma-client";

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    workspaceId: string,
    userId: string,
    input: CreateContactInput,
  ): Promise<Contact> {
    return this.prisma.contact.create({
      data: {
        ...input,
        workspaceId,
        createdById: userId,
        status: ContactStatus.ACTIVE,
      },
    });
  }

  async findAll(
    workspaceId: string,
    filters?: ContactFiltersInput,
    skip = 0,
    take = 20,
  ): Promise<{
    contacts: Contact[];
    total: number;
    hasMore: boolean;
  }> {
    const where: Prisma.ContactWhereInput = {
      workspaceId,
      deletedAt: null,
    };

    if (filters) {
      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search, mode: "insensitive" } },
          { lastName: { contains: filters.search, mode: "insensitive" } },
          { email: { contains: filters.search, mode: "insensitive" } },
          { phone: { contains: filters.search } },
          { title: { contains: filters.search, mode: "insensitive" } },
        ];
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.source) {
        where.source = filters.source;
      }

      if (filters.companyId) {
        where.companyId = filters.companyId;
      }

      if (filters.city) {
        where.city = filters.city;
      }

      if (filters.state) {
        where.state = filters.state;
      }

      if (filters.country) {
        where.country = filters.country;
      }

      if (filters.tags && filters.tags.length > 0) {
        where.tags = {
          some: {
            tag: {
              name: { in: filters.tags },
            },
          },
        };
      }
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      contacts,
      total,
      hasMore: skip + take < total,
    };
  }

  async findOne(id: string, workspaceId: string): Promise<Contact> {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!contact) {
      throw new NotFoundException("Contact not found");
    }

    return contact;
  }

  async update(
    id: string,
    workspaceId: string,
    input: Omit<UpdateContactInput, "id">,
  ): Promise<Contact> {
    await this.findOne(id, workspaceId);

    return this.prisma.contact.update({
      where: { id },
      data: {
        ...input,
        lastActivityAt: new Date(),
      },
    });
  }

  async remove(id: string, workspaceId: string): Promise<Contact> {
    await this.findOne(id, workspaceId);

    return this.prisma.contact.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async restore(id: string, workspaceId: string): Promise<Contact> {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id,
        workspaceId,
      },
    });

    if (!contact) {
      throw new NotFoundException("Contact not found");
    }

    return this.prisma.contact.update({
      where: { id },
      data: {
        deletedAt: null,
      },
    });
  }

  async search(
    workspaceId: string,
    query: string,
    filters?: ContactFiltersInput,
    skip = 0,
    take = 20,
  ): Promise<{
    contacts: Contact[];
    total: number;
    hasMore: boolean;
  }> {
    const searchConditions: Prisma.ContactWhereInput = {
      workspaceId,
      deletedAt: null,
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
        { title: { contains: query, mode: "insensitive" } },
        { bio: { contains: query, mode: "insensitive" } },
      ],
    };

    if (filters) {
      if (filters.status) {
        searchConditions.status = filters.status;
      }
      if (filters.source) {
        searchConditions.source = filters.source;
      }
      if (filters.companyId) {
        searchConditions.companyId = filters.companyId;
      }
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where: searchConditions,
        skip,
        take,
        orderBy: [
          { score: "desc" },
          { lastActivityAt: "desc" },
          { createdAt: "desc" },
        ],
      }),
      this.prisma.contact.count({ where: searchConditions }),
    ]);

    return {
      contacts,
      total,
      hasMore: skip + take < total,
    };
  }

  async updateScore(
    id: string,
    workspaceId: string,
    score: number,
  ): Promise<Contact> {
    await this.findOne(id, workspaceId);

    return this.prisma.contact.update({
      where: { id },
      data: { score },
    });
  }

  async getContactsByCompany(
    companyId: string,
    workspaceId: string,
  ): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      where: {
        companyId,
        workspaceId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async addTag(contactId: string, tagId: string, workspaceId: string) {
    await this.findOne(contactId, workspaceId);

    return this.prisma.contactTag.create({
      data: {
        contactId,
        tagId,
      },
    });
  }

  async removeTag(contactId: string, tagId: string, workspaceId: string) {
    await this.findOne(contactId, workspaceId);

    return this.prisma.contactTag.delete({
      where: {
        contactId_tagId: {
          contactId,
          tagId,
        },
      },
    });
  }

  async getTags(contactId: string, workspaceId: string): Promise<Tag[]> {
    await this.findOne(contactId, workspaceId);

    const contactTags = await this.prisma.contactTag.findMany({
      where: { contactId },
      include: { tag: true },
    });

    return contactTags.map((ct) => ct.tag);
  }
}
