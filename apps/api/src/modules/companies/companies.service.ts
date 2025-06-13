import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCompanyInput } from "./dto/create-company.input";
import { Prisma } from "../prisma/prisma-client";

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, userId: string, input: CreateCompanyInput) {
    return this.prisma.company.create({
      data: {
        ...input,
        workspaceId,
        createdById: userId,
      },
    });
  }

  async findAll(workspaceId: string, skip = 0, take = 20, search?: string) {
    const where: Prisma.CompanyWhereInput = {
      workspaceId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { domain: { contains: search, mode: "insensitive" } },
        { industry: { contains: search, mode: "insensitive" } },
      ];
    }

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      companies,
      total,
      hasMore: skip + take < total,
    };
  }

  async findOne(id: string, workspaceId: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    return company;
  }

  async update(
    id: string,
    workspaceId: string,
    input: Partial<CreateCompanyInput>,
  ) {
    await this.findOne(id, workspaceId);

    return this.prisma.company.update({
      where: { id },
      data: input,
    });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    return this.prisma.company.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
