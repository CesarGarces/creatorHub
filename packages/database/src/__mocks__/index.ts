const mockPrisma = {
  creditBalance: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  account: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  tool: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => {
    return fn(mockPrisma);
  }),
};

export const prisma = mockPrisma;
export default mockPrisma;
