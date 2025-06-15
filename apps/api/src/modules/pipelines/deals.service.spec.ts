import { Test, TestingModule } from "@nestjs/testing";
import { DealsService } from "./deals.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { DealStatus } from "../prisma/prisma-client";

describe("DealsService", () => {
  let service: DealsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    deal: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    stage: {
      findUnique: jest.fn(),
    },
    dealStageTransition: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    dealContact: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    activity: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockDeal = {
    id: "deal-1",
    workspaceId: "workspace-1",
    pipelineId: "pipeline-1",
    stageId: "stage-1",
    title: "Test Deal",
    value: { toNumber: () => 10000 },
    currency: "USD",
    probability: 50,
    status: DealStatus.OPEN,
    ownerId: "user-1",
    stageEnteredAt: new Date(),
    daysInStage: 0,
    totalDaysOpen: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    description: null,
    customFields: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DealsService>(DealsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    Object.values(mockPrismaService).forEach((mock) => {
      if (typeof mock === "object") {
        Object.values(mock).forEach((fn) => {
          if (typeof fn === "function") {
            (fn as jest.Mock).mockReset();
          }
        });
      } else if (typeof mock === "function") {
        (mock as jest.Mock).mockReset();
      }
    });
  });

  describe("create", () => {
    it("should create a deal", async () => {
      const createData = {
        pipelineId: "pipeline-1",
        stageId: "stage-1",
        title: "New Deal",
        value: 50000,
        ownerId: "user-1",
        contactIds: ["contact-1", "contact-2"],
      };

      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: createData.stageId,
        pipeline: { id: createData.pipelineId },
        probability: 20,
      });

      const createdDeal = {
        ...mockDeal,
        ...createData,
        contacts: [
          { contactId: "contact-1", isPrimary: true },
          { contactId: "contact-2", isPrimary: false },
        ],
      };

      mockPrismaService.deal.create.mockResolvedValue(createdDeal);
      mockPrismaService.activity.create.mockResolvedValue({});

      const result = await service.create("workspace-1", createData);

      expect(result).toEqual(createdDeal);
      expect(mockPrismaService.deal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "workspace-1",
          pipelineId: createData.pipelineId,
          stageId: createData.stageId,
          title: createData.title,
          value: createData.value,
          ownerId: createData.ownerId,
          currency: "USD",
          probability: 20,
          status: DealStatus.OPEN,
          stageEnteredAt: expect.any(Date),
          contacts: {
            create: expect.arrayContaining([
              { contactId: "contact-1", isPrimary: true },
              { contactId: "contact-2", isPrimary: false },
            ]),
          },
        }),
        include: expect.any(Object),
      });
    });

    it("should throw NotFoundException if stage not found", async () => {
      const createData = {
        pipelineId: "pipeline-1",
        stageId: "invalid-stage",
        title: "New Deal",
        value: 50000,
        ownerId: "user-1",
      };

      mockPrismaService.stage.findUnique.mockResolvedValue(null);

      await expect(service.create("workspace-1", createData)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("moveToStage", () => {
    it("should move deal to new stage", async () => {
      const dealId = "deal-1";
      const newStageId = "stage-2";
      const userId = "user-1";

      const dealWithRelations = {
        ...mockDeal,
        pipeline: { id: "pipeline-1" },
        stage: { id: "stage-1" },
        owner: { id: "user-1", firstName: "John", lastName: "Doe" },
      };

      mockPrismaService.deal.findUnique.mockResolvedValueOnce(
        dealWithRelations,
      );
      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: newStageId,
        pipelineId: "pipeline-1",
        probability: 50,
      });
      mockPrismaService.dealStageTransition.create.mockResolvedValue({});
      mockPrismaService.deal.update.mockResolvedValue({
        ...dealWithRelations,
        stageId: newStageId,
        probability: 50,
      });
      mockPrismaService.activity.create.mockResolvedValue({});

      const result = await service.moveToStage(dealId, newStageId, userId);

      expect(result.stageId).toBe(newStageId);
      expect(mockPrismaService.dealStageTransition.create).toHaveBeenCalledWith(
        {
          data: expect.objectContaining({
            dealId,
            fromStageId: "stage-1",
            toStageId: newStageId,
            transitionedById: userId,
            timeInStage: expect.any(Number),
          }),
        },
      );
    });

    it("should not move if already in target stage", async () => {
      const dealId = "deal-1";
      const currentStageId = "stage-1";
      const userId = "user-1";

      mockPrismaService.deal.findUnique.mockResolvedValue({
        ...mockDeal,
        stageId: currentStageId,
      });
      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: currentStageId,
        pipelineId: "pipeline-1",
      });

      const result = await service.moveToStage(dealId, currentStageId, userId);

      expect(result.stageId).toBe(currentStageId);
      expect(
        mockPrismaService.dealStageTransition.create,
      ).not.toHaveBeenCalled();
      expect(mockPrismaService.deal.update).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update deal and handle status changes", async () => {
      const dealId = "deal-1";
      const updateData = {
        status: DealStatus.WON,
        wonReason: "Great product fit",
      };

      mockPrismaService.deal.findUnique
        .mockResolvedValueOnce({
          ...mockDeal,
          status: DealStatus.OPEN,
        })
        .mockResolvedValueOnce({
          // for createActivity
          workspaceId: mockDeal.workspaceId,
          ownerId: mockDeal.ownerId,
        });
      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        ...updateData,
        closedAt: new Date(),
      });
      mockPrismaService.activity.create.mockResolvedValue({});

      const result = await service.update(dealId, updateData);

      expect(result.status).toBe(DealStatus.WON);
      expect(result.closedAt).toBeTruthy();
      expect(mockPrismaService.activity.create).toHaveBeenCalled();
    });

    it("should require reason when marking as won", async () => {
      const dealId = "deal-1";
      const updateData = {
        status: DealStatus.WON,
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

      await expect(service.update(dealId, updateData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should require reason when marking as lost", async () => {
      const dealId = "deal-1";
      const updateData = {
        status: DealStatus.LOST,
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

      await expect(service.update(dealId, updateData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("bulkMoveToStage", () => {
    it("should move multiple deals to new stage", async () => {
      const dealIds = ["deal-1", "deal-2"];
      const newStageId = "stage-2";
      const userId = "user-1";

      const deals = dealIds.map((id) => ({
        ...mockDeal,
        id,
      }));

      // Mock for each deal - findOne implementation
      deals.forEach((deal) => {
        // findOne uses findUnique
        mockPrismaService.deal.findUnique
          .mockResolvedValueOnce(deal) // for findOne
          .mockResolvedValueOnce({
            ...deal,
            pipeline: { id: "pipeline-1" },
            stage: { id: deal.stageId },
            owner: { id: "user-1", firstName: "John", lastName: "Doe" },
          }); // for moveToStage with includes

        mockPrismaService.stage.findUnique.mockResolvedValueOnce({
          id: newStageId,
          pipelineId: "pipeline-1",
          probability: 50,
        });
        mockPrismaService.dealStageTransition.create.mockResolvedValueOnce({});
        mockPrismaService.deal.update.mockResolvedValueOnce({
          ...deal,
          stageId: newStageId,
        });
        mockPrismaService.activity.create.mockResolvedValueOnce({});
      });

      const result = await service.bulkMoveToStage(dealIds, newStageId, userId);

      expect(result).toHaveLength(2);
      expect(
        mockPrismaService.dealStageTransition.create,
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe("getDealHistory", () => {
    it("should return deal stage transitions", async () => {
      const dealId = "deal-1";
      const transitions = [
        {
          id: "transition-1",
          dealId,
          fromStageId: "stage-1",
          toStageId: "stage-2",
          transitionTime: new Date(),
          timeInStage: 1440, // 1 day in minutes
          transitionedBy: { id: "user-1", firstName: "John", lastName: "Doe" },
          fromStage: { id: "stage-1", name: "Lead" },
          toStage: { id: "stage-2", name: "Qualified" },
        },
      ];

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);
      mockPrismaService.dealStageTransition.findMany.mockResolvedValue(
        transitions,
      );

      const result = await service.getDealHistory(dealId);

      expect(result).toEqual(transitions);
      expect(
        mockPrismaService.dealStageTransition.findMany,
      ).toHaveBeenCalledWith({
        where: { dealId },
        include: {
          fromStage: true,
          toStage: true,
          transitionedBy: true,
        },
        orderBy: { transitionTime: "desc" },
      });
    });

    it("should throw NotFoundException for non-existent deal", async () => {
      mockPrismaService.deal.findUnique.mockResolvedValue(null);

      await expect(service.getDealHistory("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findAll", () => {
    it("should find all deals with filters", async () => {
      const filters = {
        pipelineId: "pipeline-1",
        stageId: "stage-1",
        status: "OPEN",
        ownerId: "user-1",
        skip: 0,
        take: 10,
      };

      const deals = [mockDeal];
      mockPrismaService.deal.findMany.mockResolvedValue(deals);
      mockPrismaService.deal.count.mockResolvedValue(1);

      const result = await service.findAll("workspace-1", filters);

      expect(result).toEqual({
        deals,
        total: 1,
        hasMore: false,
      });
      expect(mockPrismaService.deal.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "workspace-1",
          deletedAt: null,
          pipelineId: filters.pipelineId,
          stageId: filters.stageId,
          status: filters.status,
          ownerId: filters.ownerId,
        },
        skip: filters.skip,
        take: filters.take,
        include: expect.any(Object),
        orderBy: [{ stage: { order: "asc" } }, { createdAt: "desc" }],
      });
    });

    it("should handle pagination", async () => {
      const filters = {
        skip: 10,
        take: 10,
      };

      const deals = Array(10).fill(mockDeal);
      mockPrismaService.deal.findMany.mockResolvedValue(deals);
      mockPrismaService.deal.count.mockResolvedValue(25);

      const result = await service.findAll("workspace-1", filters);

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(25);
    });

    it("should handle empty filters", async () => {
      const filters = {
        skip: 0,
        take: 10,
      };

      mockPrismaService.deal.findMany.mockResolvedValue([]);
      mockPrismaService.deal.count.mockResolvedValue(0);

      const result = await service.findAll("workspace-1", filters);

      expect(result).toEqual({
        deals: [],
        total: 0,
        hasMore: false,
      });
    });
  });

  describe("findOne", () => {
    it("should find a deal by id", async () => {
      mockPrismaService.deal.findUnique.mockResolvedValue({
        ...mockDeal,
        pipeline: { id: "pipeline-1", name: "Sales Pipeline" },
        stage: { id: "stage-1", name: "Lead" },
        owner: { id: "user-1", firstName: "John", lastName: "Doe" },
      });

      const result = await service.findOne("deal-1");

      expect(result).toBeDefined();
      expect(result.id).toBe("deal-1");
      expect(mockPrismaService.deal.findUnique).toHaveBeenCalledWith({
        where: { id: "deal-1" },
        include: expect.objectContaining({
          pipeline: true,
          stage: true,
          owner: true,
        }),
      });
    });

    it("should throw NotFoundException when deal not found", async () => {
      mockPrismaService.deal.findUnique.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("delete", () => {
    it("should soft delete a deal", async () => {
      const dealId = "deal-1";

      mockPrismaService.deal.findUnique.mockResolvedValueOnce(mockDeal);
      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        deletedAt: new Date(),
      });

      const result = await service.delete(dealId);

      expect(result.deletedAt).toBeTruthy();
      expect(mockPrismaService.deal.update).toHaveBeenCalledWith({
        where: { id: dealId },
        data: {
          deletedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });
    });

    it("should throw NotFoundException when deal not found", async () => {
      mockPrismaService.deal.findUnique.mockResolvedValue(null);

      await expect(service.delete("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("bulkUpdateOwner", () => {
    it("should update owner for multiple deals", async () => {
      const dealIds = ["deal-1", "deal-2"];
      const newOwnerId = "user-2";

      const deals = dealIds.map((id) => ({ ...mockDeal, id }));

      // Mock findOne for each deal
      deals.forEach((deal) => {
        mockPrismaService.deal.findUnique.mockResolvedValueOnce(deal);
      });

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: newOwnerId,
        email: "user2@example.com",
      });

      mockPrismaService.deal.updateMany.mockResolvedValue({ count: 2 });

      // Mock update for each deal
      deals.forEach((deal) => {
        mockPrismaService.deal.update.mockResolvedValueOnce({
          ...deal,
          ownerId: newOwnerId,
        });
        mockPrismaService.activity.create.mockResolvedValueOnce({});
      });

      mockPrismaService.deal.findMany.mockResolvedValue(
        deals.map((d) => ({ ...d, ownerId: newOwnerId })),
      );

      const result = await service.bulkUpdateOwner(dealIds, newOwnerId);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.deal.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: dealIds },
        },
        data: {
          ownerId: newOwnerId,
        },
      });
    });

    it("should throw NotFoundException when owner not found", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.bulkUpdateOwner(["deal-1"], "non-existent-user"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should handle bulk update with non-existent deals", async () => {
      const dealIds = ["deal-1", "non-existent"];
      const newOwnerId = "user-1";

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: newOwnerId,
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe",
      });
      mockPrismaService.deal.updateMany.mockResolvedValue({ count: 1 });

      // For createActivity calls
      mockPrismaService.deal.findUnique
        .mockResolvedValueOnce({
          workspaceId: "workspace-1",
          ownerId: "owner-1",
        }) // deal-1 exists
        .mockResolvedValueOnce(null); // non-existent deal

      mockPrismaService.activity.create.mockResolvedValue({});
      mockPrismaService.deal.findMany.mockResolvedValue([
        { ...mockDeal, id: "deal-1", ownerId: newOwnerId },
      ]);

      const result = await service.bulkUpdateOwner(dealIds, newOwnerId);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.activity.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("addContact", () => {
    it("should add a contact to a deal", async () => {
      const dealId = "deal-1";
      const contactId = "contact-1";
      const isPrimary = true;

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);
      mockPrismaService.dealContact.findUnique.mockResolvedValue(null);
      mockPrismaService.dealContact.create.mockResolvedValue({
        dealId,
        contactId,
        isPrimary,
        createdAt: new Date(),
      });

      const result = await service.addContact(dealId, contactId, isPrimary);

      expect(result).toBeDefined();
      expect(mockPrismaService.dealContact.create).toHaveBeenCalledWith({
        data: {
          dealId,
          contactId,
          isPrimary,
        },
      });
    });

    it("should return existing contact if already attached", async () => {
      const dealId = "deal-1";
      const contactId = "contact-1";

      const existingContact = {
        dealId,
        contactId,
        isPrimary: false,
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);
      mockPrismaService.dealContact.findUnique.mockResolvedValue(
        existingContact,
      );

      const result = await service.addContact(dealId, contactId, true);

      expect(result).toEqual(existingContact);
      expect(mockPrismaService.dealContact.create).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when deal not found", async () => {
      mockPrismaService.deal.findUnique.mockResolvedValue(null);

      await expect(
        service.addContact("non-existent", "contact-1", false),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("removeContact", () => {
    it("should remove a contact from a deal", async () => {
      const dealId = "deal-1";
      const contactId = "contact-1";

      mockPrismaService.dealContact.findUnique.mockResolvedValue({
        dealId,
        contactId,
        isPrimary: false,
      });
      mockPrismaService.dealContact.delete.mockResolvedValue({
        dealId,
        contactId,
      });
      mockPrismaService.deal.findUnique.mockResolvedValue({
        // for createActivity
        workspaceId: mockDeal.workspaceId,
        ownerId: mockDeal.ownerId,
      });
      mockPrismaService.activity.create.mockResolvedValue({});

      const result = await service.removeContact(dealId, contactId);

      expect(result).toBeDefined();
      expect(mockPrismaService.dealContact.delete).toHaveBeenCalledWith({
        where: {
          dealId_contactId: {
            dealId,
            contactId,
          },
        },
      });
    });

    it("should handle removing non-attached contact", async () => {
      const dealId = "deal-1";
      const contactId = "contact-1";

      mockPrismaService.dealContact.delete.mockRejectedValue(
        new Error("Record to delete does not exist."),
      );

      await expect(service.removeContact(dealId, contactId)).rejects.toThrow(
        "Record to delete does not exist.",
      );
    });
  });

  describe("edge cases", () => {
    it("should handle update with closeDate", async () => {
      const dealId = "deal-1";
      const updateData = {
        closeDate: new Date("2024-12-31"),
        value: 75000,
      };

      // Mock automationService for value change
      (service as any).automationService = {
        triggerAutomations: jest.fn().mockResolvedValue(undefined),
      };

      mockPrismaService.deal.findUnique
        .mockResolvedValueOnce(mockDeal) // for update
        .mockResolvedValueOnce({
          // for createActivity
          workspaceId: mockDeal.workspaceId,
          ownerId: mockDeal.ownerId,
        });
      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        ...updateData,
        value: { toNumber: () => 75000 },
      });
      mockPrismaService.activity.create.mockResolvedValue({});

      const result = await service.update(dealId, updateData);

      expect(result.closeDate).toEqual(updateData.closeDate);
      expect(result.value.toNumber()).toBe(updateData.value);
    });

    it("should handle reopening a closed deal", async () => {
      const dealId = "deal-1";
      const closedDeal = {
        ...mockDeal,
        status: DealStatus.WON,
        closedAt: new Date("2024-01-01"),
      };

      mockPrismaService.deal.findUnique
        .mockResolvedValueOnce(closedDeal) // for update
        .mockResolvedValueOnce({
          // for createActivity
          workspaceId: closedDeal.workspaceId,
          ownerId: closedDeal.ownerId,
        });
      mockPrismaService.deal.update.mockResolvedValue({
        ...closedDeal,
        status: DealStatus.OPEN,
        closedAt: null,
      });
      mockPrismaService.activity.create.mockResolvedValue({});

      const result = await service.update(dealId, { status: DealStatus.OPEN });

      expect(result.status).toBe(DealStatus.OPEN);
      expect(result.closedAt).toBeNull();
    });

    it("should handle stage change with different pipeline", async () => {
      const dealId = "deal-1";
      const newStageId = "stage-different-pipeline";

      mockPrismaService.deal.findUnique.mockResolvedValue({
        ...mockDeal,
        pipeline: { id: "pipeline-1" },
      });
      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: newStageId,
        pipelineId: "pipeline-2", // Different pipeline
      });

      await expect(
        service.moveToStage(dealId, newStageId, "user-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should trigger automation for value updates", async () => {
      const dealId = "deal-1";
      const updateData = {
        value: 50000,
      };

      // Mock automationService
      (service as any).automationService = {
        triggerAutomations: jest.fn().mockResolvedValue(undefined),
      };

      mockPrismaService.deal.findUnique.mockResolvedValueOnce(mockDeal);
      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        value: { toNumber: () => 50000 },
      });

      await service.update(dealId, updateData);

      expect(
        (service as any).automationService.triggerAutomations,
      ).toHaveBeenCalledWith({
        deal: expect.objectContaining({
          value: expect.objectContaining({ toNumber: expect.any(Function) }),
        }),
        trigger: "VALUE_CHANGED",
        previousValue: mockDeal.value,
        newValue: 50000,
        userId: mockDeal.ownerId,
      });
    });

    it("should handle no activity creation when value unchanged", async () => {
      const dealId = "deal-1";
      const updateData = {
        title: "Updated Title",
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);
      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        title: updateData.title,
      });

      await service.update(dealId, updateData);

      // Activity should not be created for title updates
      expect(mockPrismaService.activity.create).not.toHaveBeenCalled();
    });

    it("should test setAutomationService", () => {
      const mockAutomationService = {
        triggerAutomations: jest.fn(),
      };

      service.setAutomationService(mockAutomationService);

      expect((service as any).automationService).toBe(mockAutomationService);
    });

    it("should handle create without automation service", async () => {
      const createData = {
        pipelineId: "pipeline-1",
        stageId: "stage-1",
        title: "New Deal",
        value: 50000,
        ownerId: "user-1",
      };

      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: createData.stageId,
        pipeline: { id: createData.pipelineId },
        probability: 20,
        name: "Lead",
      });

      const createdDeal = {
        ...mockDeal,
        ...createData,
      };

      mockPrismaService.deal.create.mockResolvedValue(createdDeal);
      mockPrismaService.activity.create.mockResolvedValue({});

      // No automation service set
      (service as any).automationService = null;

      const result = await service.create("workspace-1", createData);

      expect(result).toEqual(createdDeal);
      // Should not throw even without automation service
    });

    it("should update days in stage when different", async () => {
      const dealId = "deal-1";
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 5); // 5 days ago

      const dealWithOldDays = {
        ...mockDeal,
        stageEnteredAt: oldDate,
        createdAt: oldDate,
        daysInStage: 0, // Old value
        totalDaysOpen: 0, // Old value
      };

      mockPrismaService.deal.findUnique.mockResolvedValue({
        ...dealWithOldDays,
        pipeline: { id: "pipeline-1", name: "Sales Pipeline" },
        stage: { id: "stage-1", name: "Lead" },
        owner: { id: "user-1", firstName: "John", lastName: "Doe" },
      });

      mockPrismaService.deal.update.mockResolvedValue({
        ...dealWithOldDays,
        daysInStage: 5,
        totalDaysOpen: 5,
      });

      const result = await service.findOne(dealId);

      expect(mockPrismaService.deal.update).toHaveBeenCalledWith({
        where: { id: dealId },
        data: { daysInStage: 5, totalDaysOpen: 5 },
      });
      expect(result.daysInStage).toBe(5);
      expect(result.totalDaysOpen).toBe(5);
    });

    it("should not update days when they are the same", async () => {
      const dealId = "deal-1";

      mockPrismaService.deal.findUnique.mockResolvedValue({
        ...mockDeal,
        daysInStage: 0,
        totalDaysOpen: 0,
        pipeline: { id: "pipeline-1", name: "Sales Pipeline" },
        stage: { id: "stage-1", name: "Lead" },
        owner: { id: "user-1", firstName: "John", lastName: "Doe" },
      });

      const result = await service.findOne(dealId);

      expect(mockPrismaService.deal.update).not.toHaveBeenCalled();
      expect(result.daysInStage).toBe(0);
    });

    it("should handle update with status change but no automation service", async () => {
      const dealId = "deal-1";
      const updateData = {
        status: DealStatus.WON,
        wonReason: "Great product fit",
      };

      // No automation service set
      (service as any).automationService = null;

      mockPrismaService.deal.findUnique
        .mockResolvedValueOnce({
          ...mockDeal,
          status: DealStatus.OPEN,
        })
        .mockResolvedValueOnce({
          // for createActivity
          workspaceId: mockDeal.workspaceId,
          ownerId: mockDeal.ownerId,
        });
      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        ...updateData,
        closedAt: new Date(),
      });
      mockPrismaService.activity.create.mockResolvedValue({});

      const result = await service.update(dealId, updateData);

      expect(result.status).toBe(DealStatus.WON);
      // Should not throw even without automation service
    });

    it("should handle update with owner change but no automation service", async () => {
      const dealId = "deal-1";
      const updateData = {
        ownerId: "user-2",
      };

      // No automation service set
      (service as any).automationService = null;

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);
      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        ownerId: updateData.ownerId,
      });

      const result = await service.update(dealId, updateData);

      expect(result.ownerId).toBe("user-2");
      // Should not throw even without automation service
    });

    it("should handle moveToStage without automation service", async () => {
      const dealId = "deal-1";
      const newStageId = "stage-2";
      const userId = "user-1";

      // No automation service set
      (service as any).automationService = null;

      const dealWithRelations = {
        ...mockDeal,
        pipeline: { id: "pipeline-1" },
        stage: { id: "stage-1", name: "Lead" },
        owner: { id: "user-1", firstName: "John", lastName: "Doe" },
      };

      mockPrismaService.deal.findUnique.mockResolvedValueOnce(
        dealWithRelations,
      );
      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: newStageId,
        pipelineId: "pipeline-1",
        probability: 50,
        name: "Qualified",
      });
      mockPrismaService.dealStageTransition.create.mockResolvedValue({});
      mockPrismaService.deal.update.mockResolvedValue({
        ...dealWithRelations,
        stageId: newStageId,
        probability: 50,
      });
      mockPrismaService.activity.create.mockResolvedValue({});

      const result = await service.moveToStage(dealId, newStageId, userId);

      expect(result.stageId).toBe(newStageId);
      // Should not throw even without automation service
    });

    it("should return existing contact in addContact", async () => {
      const dealId = "deal-1";
      const contactId = "contact-1";

      const existingContact = {
        dealId,
        contactId,
        isPrimary: true,
        createdAt: new Date(),
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);
      mockPrismaService.dealContact.findUnique.mockResolvedValue(
        existingContact,
      );

      const result = await service.addContact(dealId, contactId, false);

      expect(result).toEqual(existingContact);
      expect(mockPrismaService.dealContact.create).not.toHaveBeenCalled();
      expect(mockPrismaService.activity.create).not.toHaveBeenCalled();
    });

    it("should handle createActivity gracefully when deal not found", async () => {
      const dealIds = ["deal-1", "deal-2"];
      const newOwnerId = "user-2";

      const owner = {
        id: newOwnerId,
        email: "user2@example.com",
        firstName: "Jane",
        lastName: "Smith",
      };

      mockPrismaService.user.findUnique.mockResolvedValue(owner);
      mockPrismaService.deal.updateMany.mockResolvedValue({ count: 2 });

      // First deal exists, second doesn't (for createActivity)
      mockPrismaService.deal.findUnique
        .mockResolvedValueOnce({
          workspaceId: "workspace-1",
          ownerId: "user-1",
        }) // for first createActivity
        .mockResolvedValueOnce(null); // for second createActivity - deal not found

      mockPrismaService.activity.create.mockResolvedValue({});
      mockPrismaService.deal.findMany.mockResolvedValue([
        { ...mockDeal, id: "deal-1", ownerId: newOwnerId },
      ]);

      const result = await service.bulkUpdateOwner(dealIds, newOwnerId);

      expect(result).toHaveLength(1);
      // Activity should only be created for the first deal
      expect(mockPrismaService.activity.create).toHaveBeenCalledTimes(1);
    });

    it("should handle removeContact with deal not found", async () => {
      const dealId = "deal-1";
      const contactId = "contact-1";

      const dealContact = {
        dealId,
        contactId,
        isPrimary: false,
      };

      mockPrismaService.dealContact.findUnique.mockResolvedValue(dealContact);
      mockPrismaService.dealContact.delete.mockResolvedValue(dealContact);
      mockPrismaService.deal.findUnique.mockResolvedValue(null); // Deal not found for activity

      const result = await service.removeContact(dealId, contactId);

      expect(result).toEqual(dealContact);
      // Activity creation should fail silently when deal not found
      expect(mockPrismaService.activity.create).not.toHaveBeenCalled();
    });

    it("should trigger all automations with service set", async () => {
      const mockAutomationService = {
        triggerAutomations: jest.fn().mockResolvedValue(undefined),
      };

      service.setAutomationService(mockAutomationService);

      // Test create with automation
      const createData = {
        pipelineId: "pipeline-1",
        stageId: "stage-1",
        title: "New Deal",
        value: 50000,
        ownerId: "user-1",
      };

      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: createData.stageId,
        pipeline: { id: createData.pipelineId },
        probability: 20,
        name: "Lead",
      });

      mockPrismaService.deal.create.mockResolvedValue({
        ...mockDeal,
        ...createData,
      });
      mockPrismaService.activity.create.mockResolvedValue({});

      await service.create("workspace-1", createData);

      expect(mockAutomationService.triggerAutomations).toHaveBeenCalledWith({
        deal: expect.any(Object),
        trigger: "DEAL_CREATED",
        userId: createData.ownerId,
      });

      // Reset mock
      mockAutomationService.triggerAutomations.mockClear();

      // Test update with status change
      mockPrismaService.deal.findUnique
        .mockResolvedValueOnce({
          ...mockDeal,
          status: DealStatus.OPEN,
        })
        .mockResolvedValueOnce({
          // for createActivity
          workspaceId: mockDeal.workspaceId,
          ownerId: mockDeal.ownerId,
        });
      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        status: DealStatus.WON,
        closedAt: new Date(),
      });

      await service.update("deal-1", {
        status: DealStatus.WON,
        wonReason: "Great fit",
      });

      expect(mockAutomationService.triggerAutomations).toHaveBeenCalledWith({
        deal: expect.any(Object),
        trigger: "DEAL_WON",
        previousValue: DealStatus.OPEN,
        newValue: DealStatus.WON,
        userId: mockDeal.ownerId,
      });

      // Reset mock
      mockAutomationService.triggerAutomations.mockClear();

      // Test update with owner change
      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);
      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        ownerId: "user-2",
      });

      await service.update("deal-1", { ownerId: "user-2" });

      expect(mockAutomationService.triggerAutomations).toHaveBeenCalledWith({
        deal: expect.any(Object),
        trigger: "OWNER_CHANGED",
        previousValue: mockDeal.ownerId,
        newValue: "user-2",
        userId: "user-2",
      });

      // Reset mock
      mockAutomationService.triggerAutomations.mockClear();

      // Test moveToStage with automation
      const dealWithRelations = {
        ...mockDeal,
        pipeline: { id: "pipeline-1" },
        stage: { id: "stage-1", name: "Lead" },
        owner: { id: "user-1", firstName: "John", lastName: "Doe" },
      };

      mockPrismaService.deal.findUnique.mockResolvedValueOnce(
        dealWithRelations,
      );
      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: "stage-2",
        pipelineId: "pipeline-1",
        probability: 50,
        name: "Qualified",
      });
      mockPrismaService.dealStageTransition.create.mockResolvedValue({});
      mockPrismaService.deal.update.mockResolvedValue({
        ...dealWithRelations,
        stageId: "stage-2",
        probability: 50,
      });

      await service.moveToStage("deal-1", "stage-2", "user-1");

      // Should be called twice - once for stage exit, once for stage enter
      expect(mockAutomationService.triggerAutomations).toHaveBeenCalledTimes(2);
      expect(mockAutomationService.triggerAutomations).toHaveBeenCalledWith({
        deal: expect.any(Object),
        trigger: "STAGE_EXIT",
        previousValue: "stage-1",
        newValue: "stage-2",
        userId: "user-1",
      });
      expect(mockAutomationService.triggerAutomations).toHaveBeenCalledWith({
        deal: expect.any(Object),
        trigger: "STAGE_ENTER",
        previousValue: "stage-1",
        newValue: "stage-2",
        userId: "user-1",
      });
    });
  });
});
