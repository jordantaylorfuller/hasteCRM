import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { stringify } from "csv-stringify/sync";
import * as XLSX from "xlsx";
import { Prisma } from "../../prisma/prisma-client";

@Injectable()
export class ContactExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportContacts(
    workspaceId: string,
    userId: string,
    format: string,
    fields?: string[],
    filters?: any,
  ) {
    // Default fields if none specified
    const exportFields = fields || [
      "firstName",
      "lastName",
      "email",
      "phone",
      "title",
      "company",
      "city",
      "state",
      "country",
      "source",
      "status",
      "createdAt",
    ];

    // Build where clause
    const where: Prisma.ContactWhereInput = {
      workspaceId,
      deletedAt: null,
      ...filters,
    };

    // Fetch contacts with companies
    const contacts = await this.prisma.contact.findMany({
      where,
      include: {
        company: true,
      },
    });

    // Create export record
    const exportRecord = await this.prisma.export.create({
      data: {
        workspaceId,
        exportedById: userId,
        type: "contacts",
        format,
        filters: filters || {},
        fields: exportFields,
        rowCount: contacts.length,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Transform data for export
    const exportData = contacts.map((contact) => {
      const row: any = {};
      for (const field of exportFields) {
        if (field === "company" && contact.company) {
          row[field] = contact.company.name;
        } else {
          row[field] = contact[field as keyof typeof contact] || "";
        }
      }
      return row;
    });

    let fileContent: string;
    let mimeType: string;

    // Generate file content based on format
    if (format === "csv") {
      fileContent = stringify(exportData, {
        header: true,
        columns: exportFields,
      });
      mimeType = "text/csv";
    } else if (format === "json") {
      fileContent = JSON.stringify(exportData, null, 2);
      mimeType = "application/json";
    } else if (format === "xlsx") {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
      fileContent = XLSX.write(workbook, { type: "string", bookType: "xlsx" });
      mimeType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else {
      throw new Error("Unsupported export format");
    }

    // In production, you would upload to S3 or similar
    // For now, we'll return the content directly
    const fileUrl = `data:${mimeType};base64,${Buffer.from(fileContent).toString("base64")}`;

    // Update export record with file URL
    await this.prisma.export.update({
      where: { id: exportRecord.id },
      data: { fileUrl },
    });

    return {
      exportId: exportRecord.id,
      fileUrl,
      rowCount: contacts.length,
      format,
      expiresAt: exportRecord.expiresAt,
    };
  }

  async getExportStatus(exportId: string, workspaceId: string) {
    const exportRecord = await this.prisma.export.findFirst({
      where: {
        id: exportId,
        workspaceId,
      },
    });

    if (!exportRecord) {
      throw new Error("Export not found");
    }

    return exportRecord;
  }
}
