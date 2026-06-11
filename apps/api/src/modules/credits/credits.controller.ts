import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { CreditService, BillingService } from "@creator-hub/billing";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";

@Controller("credits")
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(
    private creditService: CreditService,
    private billingService: BillingService
  ) {}

  @Get("balance")
  async getBalance(@CurrentUser("id") userId: string) {
    const balance = await this.creditService.getBalance(userId);
    return { balance };
  }

  @Get("plans")
  async getPlans() {
    return this.billingService.getPlans();
  }

  @Post("subscribe")
  async subscribe(@CurrentUser("id") userId: string, @Body("planId") planId: string) {
    return this.billingService.subscribe(userId, planId);
  }
}
