import { Test, TestingModule } from "@nestjs/testing";
import { PipelinesResolver, DealsResolver } from "./pipelines.resolver";
import { PipelinesService } from "./pipelines.service";
import { DealsService } from "./deals.service";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";

// Mock the guard to bypass authentication in tests
jest.mock("../../common/guards/custom-gql-auth.guard", () => ({
  CustomGqlAuthGuard: jest.fn().mockImplementation(() => ({
    canActivate: jest.fn().mockResolvedValue(true),
  })),
}));

describe("PipelinesResolver", () => {
  let resolver: PipelinesResolver;
  let service: PipelinesService;

  const mockPipelinesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getPipelineMetrics: jest.fn(),
    reorderPipelines: jest.fn(),
    createStage: jest.fn(),
    updateStage: jest.fn(),
    deleteStage: jest.fn(),
    reorderStages: jest.fn(),
  };

  const mockDealsService = {
    // Not used in PipelinesResolver, but required for constructor
  };

  const mockContext = {
    req: {
      user: {
        workspaceId: "workspace-123",
        userId: "user-123",
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelinesResolver,
        {
          provide: PipelinesService,
          useValue: mockPipelinesService,
        },
        {
          provide: DealsService,
          useValue: mockDealsService,
        },
      ],
    }).compile();

    resolver = module.get<PipelinesResolver>(PipelinesResolver);
    service = module.get<PipelinesService>(PipelinesService);

    jest.clearAllMocks();
  });

  describe("pipelines query", () => {
    it("should return all pipelines", async () => {
      const mockPipelines = [
        { id: "pipeline-1", name: "Sales Pipeline" },
        { id: "pipeline-2", name: "Support Pipeline" },
      ];

      mockPipelinesService.findAll.mockResolvedValue(mockPipelines);

      const result = await resolver.pipelines(mockContext);

      expect(result).toEqual(mockPipelines);
      expect(mockPipelinesService.findAll).toHaveBeenCalledWith(
        "workspace-123",
      );
    });
  });

  describe("pipeline query", () => {
    it("should return a single pipeline", async () => {
      const mockPipeline = { id: "pipeline-1", name: "Sales Pipeline" };

      mockPipelinesService.findOne.mockResolvedValue(mockPipeline);

      const result = await resolver.pipeline("pipeline-1");

      expect(result).toEqual(mockPipeline);
      expect(mockPipelinesService.findOne).toHaveBeenCalledWith("pipeline-1");
    });
  });

  describe("pipelineMetrics query", () => {
    it("should return pipeline metrics", async () => {
      const mockMetrics = {
        totalDeals: 100,
        wonDeals: 30,
        lostDeals: 20,
        openDeals: 50,
      };

      mockPipelinesService.getPipelineMetrics.mockResolvedValue(mockMetrics);

      const result = await resolver.pipelineMetrics("pipeline-1");

      expect(result).toEqual(mockMetrics);
      expect(mockPipelinesService.getPipelineMetrics).toHaveBeenCalledWith(
        "pipeline-1",
        undefined,
      );
    });

    it("should accept date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      mockPipelinesService.getPipelineMetrics.mockResolvedValue({});

      await resolver.pipelineMetrics("pipeline-1", startDate, endDate);

      expect(mockPipelinesService.getPipelineMetrics).toHaveBeenCalledWith(
        "pipeline-1",
        { start: startDate, end: endDate },
      );
    });
  });

  describe("createPipeline mutation", () => {
    it("should create a pipeline", async () => {
      const createInput = {
        name: "New Pipeline",
        description: "Test pipeline",
        stages: [
          { name: "Lead", order: 0 },
          { name: "Qualified", order: 1 },
        ],
      };

      const mockCreatedPipeline = {
        id: "pipeline-new",
        ...createInput,
      };

      mockPipelinesService.create.mockResolvedValue(mockCreatedPipeline);

      const result = await resolver.createPipeline(createInput, mockContext);

      expect(result).toEqual(mockCreatedPipeline);
      expect(mockPipelinesService.create).toHaveBeenCalledWith(
        "workspace-123",
        createInput,
      );
    });
  });

  describe("updatePipeline mutation", () => {
    it("should update a pipeline", async () => {
      const updateInput = {
        name: "Updated Pipeline",
      };

      const mockUpdatedPipeline = {
        id: "pipeline-1",
        name: "Updated Pipeline",
        description: "Original description",
      };

      mockPipelinesService.update.mockResolvedValue(mockUpdatedPipeline);

      const result = await resolver.updatePipeline("pipeline-1", updateInput);

      expect(result).toEqual(mockUpdatedPipeline);
      expect(mockPipelinesService.update).toHaveBeenCalledWith(
        "pipeline-1",
        updateInput,
      );
    });
  });

  describe("deletePipeline mutation", () => {
    it("should delete a pipeline", async () => {
      const mockDeletedPipeline = {
        id: "pipeline-1",
        name: "Deleted Pipeline",
      };

      mockPipelinesService.delete.mockResolvedValue(mockDeletedPipeline);

      const result = await resolver.deletePipeline("pipeline-1");

      expect(result).toEqual(mockDeletedPipeline);
      expect(mockPipelinesService.delete).toHaveBeenCalledWith("pipeline-1");
    });
  });

  describe("reorderPipelines mutation", () => {
    it("should reorder pipelines", async () => {
      const input = { ids: ["pipeline-2", "pipeline-1", "pipeline-3"] };
      const mockReorderedPipelines = [
        { id: "pipeline-2", order: 0 },
        { id: "pipeline-1", order: 1 },
        { id: "pipeline-3", order: 2 },
      ];

      mockPipelinesService.reorderPipelines.mockResolvedValue(
        mockReorderedPipelines,
      );

      const result = await resolver.reorderPipelines(input, mockContext);

      expect(result).toEqual(mockReorderedPipelines);
      expect(mockPipelinesService.reorderPipelines).toHaveBeenCalledWith(
        "workspace-123",
        input.ids,
      );
    });
  });

  describe("createStage mutation", () => {
    it("should create a stage", async () => {
      const mockCreatedStage = {
        id: "stage-new",
        name: "New Stage",
        color: "#FF0000",
        probability: 50,
      };

      mockPipelinesService.createStage.mockResolvedValue(mockCreatedStage);

      const result = await resolver.createStage(
        "pipeline-1",
        "New Stage",
        "#FF0000",
        50,
      );

      expect(result).toEqual(mockCreatedStage);
      expect(mockPipelinesService.createStage).toHaveBeenCalledWith(
        "pipeline-1",
        {
          name: "New Stage",
          color: "#FF0000",
          probability: 50,
        },
      );
    });

    it("should create stage with defaults", async () => {
      const mockCreatedStage = {
        id: "stage-new",
        name: "New Stage",
      };

      mockPipelinesService.createStage.mockResolvedValue(mockCreatedStage);

      const result = await resolver.createStage("pipeline-1", "New Stage");

      expect(result).toEqual(mockCreatedStage);
      expect(mockPipelinesService.createStage).toHaveBeenCalledWith(
        "pipeline-1",
        {
          name: "New Stage",
          color: undefined,
          probability: undefined,
        },
      );
    });
  });

  describe("updateStage mutation", () => {
    it("should update a stage", async () => {
      const mockUpdatedStage = {
        id: "stage-1",
        name: "Updated Stage",
        color: "#00FF00",
        probability: 75,
      };

      mockPipelinesService.updateStage.mockResolvedValue(mockUpdatedStage);

      const result = await resolver.updateStage(
        "stage-1",
        "Updated Stage",
        "#00FF00",
        75,
      );

      expect(result).toEqual(mockUpdatedStage);
      expect(mockPipelinesService.updateStage).toHaveBeenCalledWith("stage-1", {
        name: "Updated Stage",
        color: "#00FF00",
        probability: 75,
      });
    });
  });

  describe("deleteStage mutation", () => {
    it("should delete a stage", async () => {
      const mockDeletedStage = {
        id: "stage-1",
        name: "Deleted Stage",
      };

      mockPipelinesService.deleteStage.mockResolvedValue(mockDeletedStage);

      const result = await resolver.deleteStage("stage-1");

      expect(result).toEqual(mockDeletedStage);
      expect(mockPipelinesService.deleteStage).toHaveBeenCalledWith("stage-1");
    });
  });

  describe("reorderStages mutation", () => {
    it("should reorder stages", async () => {
      const input = { ids: ["stage-2", "stage-1", "stage-3"] };
      const mockReorderedStages = [
        { id: "stage-2", order: 0 },
        { id: "stage-1", order: 1 },
        { id: "stage-3", order: 2 },
      ];

      mockPipelinesService.reorderStages.mockResolvedValue(mockReorderedStages);

      const result = await resolver.reorderStages("pipeline-1", input);

      expect(result).toEqual(mockReorderedStages);
      expect(mockPipelinesService.reorderStages).toHaveBeenCalledWith(
        "pipeline-1",
        input.ids,
      );
    });
  });
});

describe("DealsResolver", () => {
  let resolver: DealsResolver;
  let service: DealsService;

  const mockDealsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getDealHistory: jest.fn(),
    moveToStage: jest.fn(),
    bulkMoveToStage: jest.fn(),
    bulkUpdateOwner: jest.fn(),
  };

  const mockContext = {
    req: {
      user: {
        workspaceId: "workspace-123",
        userId: "user-123",
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealsResolver,
        {
          provide: DealsService,
          useValue: mockDealsService,
        },
      ],
    }).compile();

    resolver = module.get<DealsResolver>(DealsResolver);
    service = module.get<DealsService>(DealsService);

    jest.clearAllMocks();
  });

  describe("deals query", () => {
    it("should return deals with filters", async () => {
      const mockDeals = {
        deals: [
          { id: "deal-1", title: "Deal 1" },
          { id: "deal-2", title: "Deal 2" },
        ],
        total: 2,
      };

      mockDealsService.findAll.mockResolvedValue(mockDeals);

      const result = await resolver.deals(
        "pipeline-1",
        "stage-1",
        "OPEN",
        "user-123",
        0,
        10,
        mockContext,
      );

      expect(result).toEqual(mockDeals);
      expect(mockDealsService.findAll).toHaveBeenCalledWith("workspace-123", {
        pipelineId: "pipeline-1",
        stageId: "stage-1",
        status: "OPEN",
        ownerId: "user-123",
        skip: 0,
        take: 10,
      });
    });

    it("should use default pagination", async () => {
      mockDealsService.findAll.mockResolvedValue({ deals: [], total: 0 });

      await resolver.deals(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        mockContext,
      );

      expect(mockDealsService.findAll).toHaveBeenCalledWith("workspace-123", {
        pipelineId: undefined,
        stageId: undefined,
        status: undefined,
        ownerId: undefined,
        skip: 0,
        take: 20,
      });
    });
  });

  describe("deal query", () => {
    it("should return a single deal", async () => {
      const mockDeal = { id: "deal-1", title: "Test Deal" };

      mockDealsService.findOne.mockResolvedValue(mockDeal);

      const result = await resolver.deal("deal-1");

      expect(result).toEqual(mockDeal);
      expect(mockDealsService.findOne).toHaveBeenCalledWith("deal-1");
    });
  });

  describe("dealHistory query", () => {
    it("should return deal history", async () => {
      const mockHistory = [
        { id: "history-1", action: "STAGE_CHANGED" },
        { id: "history-2", action: "VALUE_UPDATED" },
      ];

      mockDealsService.getDealHistory.mockResolvedValue(mockHistory);

      const result = await resolver.dealHistory("deal-1");

      expect(result).toEqual(mockHistory);
      expect(mockDealsService.getDealHistory).toHaveBeenCalledWith("deal-1");
    });
  });

  describe("createDeal mutation", () => {
    it("should create a deal", async () => {
      const createInput = {
        title: "New Deal",
        value: 10000,
        stageId: "stage-1",
        contactId: "contact-1",
      };

      const mockCreatedDeal = {
        id: "deal-new",
        ...createInput,
      };

      mockDealsService.create.mockResolvedValue(mockCreatedDeal);

      const result = await resolver.createDeal(createInput, mockContext);

      expect(result).toEqual(mockCreatedDeal);
      expect(mockDealsService.create).toHaveBeenCalledWith(
        "workspace-123",
        createInput,
      );
    });
  });

  describe("updateDeal mutation", () => {
    it("should update a deal", async () => {
      const updateInput = {
        title: "Updated Deal",
        value: 15000,
      };

      const mockUpdatedDeal = {
        id: "deal-1",
        ...updateInput,
      };

      mockDealsService.update.mockResolvedValue(mockUpdatedDeal);

      const result = await resolver.updateDeal("deal-1", updateInput);

      expect(result).toEqual(mockUpdatedDeal);
      expect(mockDealsService.update).toHaveBeenCalledWith(
        "deal-1",
        updateInput,
      );
    });
  });

  describe("moveDeal mutation", () => {
    it("should move a deal to another stage", async () => {
      const input = {
        dealId: "deal-1",
        stageId: "stage-2",
        reason: "Qualified lead",
      };

      const mockMovedDeal = {
        id: "deal-1",
        stageId: "stage-2",
      };

      mockDealsService.moveToStage.mockResolvedValue(mockMovedDeal);

      const result = await resolver.moveDeal(input, mockContext);

      expect(result).toEqual(mockMovedDeal);
      expect(mockDealsService.moveToStage).toHaveBeenCalledWith(
        "deal-1",
        "stage-2",
        "user-123",
        "Qualified lead",
      );
    });
  });

  describe("deleteDeal mutation", () => {
    it("should delete a deal", async () => {
      const mockDeletedDeal = {
        id: "deal-1",
        title: "Deleted Deal",
      };

      mockDealsService.delete.mockResolvedValue(mockDeletedDeal);

      const result = await resolver.deleteDeal("deal-1");

      expect(result).toEqual(mockDeletedDeal);
      expect(mockDealsService.delete).toHaveBeenCalledWith("deal-1");
    });
  });

  describe("bulkMoveDeal mutation", () => {
    it("should move multiple deals", async () => {
      const dealIds = ["deal-1", "deal-2", "deal-3"];
      const mockMovedDeals = dealIds.map((id) => ({ id, stageId: "stage-2" }));

      mockDealsService.bulkMoveToStage.mockResolvedValue(mockMovedDeals);

      const result = await resolver.bulkMoveDeal(
        dealIds,
        "stage-2",
        mockContext,
      );

      expect(result).toEqual(mockMovedDeals);
      expect(mockDealsService.bulkMoveToStage).toHaveBeenCalledWith(
        dealIds,
        "stage-2",
        "user-123",
      );
    });
  });

  describe("bulkUpdateDealOwner mutation", () => {
    it("should update owner for multiple deals", async () => {
      const dealIds = ["deal-1", "deal-2"];
      const mockUpdatedDeals = dealIds.map((id) => ({
        id,
        ownerId: "user-456",
      }));

      mockDealsService.bulkUpdateOwner.mockResolvedValue(mockUpdatedDeals);

      const result = await resolver.bulkUpdateDealOwner(dealIds, "user-456");

      expect(result).toEqual(mockUpdatedDeals);
      expect(mockDealsService.bulkUpdateOwner).toHaveBeenCalledWith(
        dealIds,
        "user-456",
      );
    });
  });
});
