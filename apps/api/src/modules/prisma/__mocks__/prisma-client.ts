export class PrismaClient {
  $connect = jest.fn();
  $disconnect = jest.fn();
  $on = jest.fn();

  constructor() {
    // Mock constructor
  }
}
