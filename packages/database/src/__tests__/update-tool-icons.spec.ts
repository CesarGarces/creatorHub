export {}; // module scope: keeps mock names local to this file

const mockUpdateMany = jest.fn(async () => ({ count: 1 }));
const mockDisconnect = jest.fn(async () => {});

jest.mock("../../generated/client", () => ({
  PrismaClient: jest.fn(() => ({
    tool: { updateMany: mockUpdateMany },
    $disconnect: mockDisconnect,
  })),
}));

describe("update-tool-icons script", () => {
  it("sets the icon of each known tool and disconnects", async () => {
    jest.spyOn(console, "log").mockImplementation(() => {});

    jest.isolateModules(() => {
      require("../update-tool-icons");
    });
    for (let i = 0; i < 50 && mockDisconnect.mock.calls.length === 0; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    expect(mockUpdateMany.mock.calls).toEqual([
      [{ where: { id: "thumbnail-generator" }, data: { icon: "🎨" } }],
      [{ where: { id: "content-translator" }, data: { icon: "🌐" } }],
      [{ where: { id: "x-post-tweet" }, data: { icon: "💬" } }],
      [{ where: { id: "x-search-trends" }, data: { icon: "📡" } }],
    ]);
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
