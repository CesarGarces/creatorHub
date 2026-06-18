describe("Checkout flow", () => {
  it("logs in, saves refresh token, and starts checkout", () => {
    // Stub login API to return access + refresh tokens
    cy.intercept("POST", "**/auth/login", {
      statusCode: 200,
      body: {
        accessToken: "access-123",
        refreshToken: "refresh-abc",
        user: { id: "u1", email: "test@local", role: "user" },
      },
    }).as("login");

    // Stub checkout creation to return a gateway URL
    cy.intercept("POST", "**/credits/checkout", {
      statusCode: 200,
      body: {
        gatewayUrl: "https://checkout.example.com/intent/123",
        gatewayTxId: "tx123",
      },
    }).as("checkout");

    // Stub plans fetch so the Credits page renders a Subscribe button
    cy.intercept("GET", "**/credits/plans", {
      statusCode: 200,
      body: [
        {
          id: "plan_1",
          name: "Starter",
          price: 500,
          creditsPerMonth: 100,
          features: ["A", "B"],
        },
      ],
    }).as("plans");

    // Visit login page and submit form using name attributes
    cy.visit("/login");
    cy.get('input[name="email"]').type("test@local");
    cy.get('input[name="password"]').type("password");
    cy.get('button[type="submit"]').click();

    cy.wait("@login");

    // assert user is stored in sessionStorage (app stores user there)
    cy.window()
      .its("sessionStorage")
      .invoke("getItem", "ch_user")
      .should("not.be.null");

    // Go to credits page and click buy button (uses data-test)
    cy.visit("/credits");
    cy.get('[data-test="buy-plan"]').first().click();

    cy.wait("@checkout");

    // Assert stubbed gateway URL present in intercepted response
    cy.get("@checkout").then((xhr) => {
      const body = xhr.response.body as Record<string, unknown>;
      expect(body.gatewayUrl || body.redirectUrl).to.not.equal(undefined);
    });
  });
});
