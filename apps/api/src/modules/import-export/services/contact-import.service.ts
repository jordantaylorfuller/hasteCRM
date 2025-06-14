import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ContactsService } from "../../contacts/contacts.service";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { ImportStatus, ContactSource } from "../../prisma/prisma-client";

@Injectable()
export class ContactImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contactsService: ContactsService,
  ) {}

  async importContacts(
    workspaceId: string,
    userId: string,
    fileContent: string,
    format: string,
    mapping: Record<string, string>,
  ) {
    // Create import record
    const importRecord = await this.prisma.import.create({
      data: {
        workspaceId,
        importedById: userId,
        type: "contacts",
        filename: "contacts_import",
        fileUrl: "",
        mapping,
        status: ImportStatus.PROCESSING,
      },
    });

    try {
      let records: any[] = [];

      // Parse file based on format
      if (format === "csv") {
        records = this.parseCsv(fileContent);
      } else if (format === "json") {
        records = JSON.parse(fileContent);
      } else if (format === "xlsx") {
        records = this.parseExcel(fileContent);
      } else {
        throw new BadRequestException("Unsupported file format");
      }

      const results = {
        total: records.length,
        processed: 0,
        success: 0,
        errors: [] as any[],
      };

      // Process each record
      for (const record of records) {
        try {
          const contactData = this.mapRecordToContact(record, mapping);

          // Check if contact exists
          const existingContact = await this.prisma.contact.findFirst({
            where: {
              workspaceId,
              email: contactData.email,
              deletedAt: null,
            },
          });

          if (existingContact) {
            // Update existing contact
            await this.contactsService.update(
              existingContact.id,
              workspaceId,
              contactData,
            );
          } else {
            // Create new contact
            await this.contactsService.create(workspaceId, userId, {
              ...contactData,
              source: ContactSource.IMPORT,
            });
          }

          results.success++;
        } catch (error) {
          results.errors.push({
            row: results.processed + 1,
            error: error.message,
            data: record,
          });
        }

        results.processed++;
      }

      // Update import record
      await this.prisma.import.update({
        where: { id: importRecord.id },
        data: {
          status:
            results.errors.length > 0
              ? ImportStatus.PARTIAL
              : ImportStatus.COMPLETED,
          totalRows: results.total,
          processedRows: results.processed,
          successRows: results.success,
          errorRows: results.errors.length,
          errors: results.errors,
          completedAt: new Date(),
        },
      });

      return {
        importId: importRecord.id,
        ...results,
      };
    } catch (error) {
      // Update import record with failure
      await this.prisma.import.update({
        where: { id: importRecord.id },
        data: {
          status: ImportStatus.FAILED,
          errors: [{ error: error.message }],
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  private parseCsv(content: string): any[] {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  }

  private parseExcel(content: string): any[] {
    const workbook = XLSX.read(content, { type: "string" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  }

  private mapRecordToContact(
    record: any,
    mapping: Record<string, string>,
  ): any {
    const contact: any = {};

    for (const [csvField, contactField] of Object.entries(mapping)) {
      if (record[csvField] !== undefined && record[csvField] !== "") {
        contact[contactField] = record[csvField];
      }
    }

    return contact;
  }

  async getImportStatus(importId: string, workspaceId: string): Promise<any> {
    const importRecord = await this.prisma.import.findFirst({
      where: {
        id: importId,
        workspaceId,
      },
    });

    if (!importRecord) {
      throw new BadRequestException("Import not found");
    }

    return importRecord;
  }
}
