import { Global, Module } from "@nestjs/common";
import { SentryService } from "./sentry.service";

/**
 * Sentry Module for Creator Hub
 *
 * Global module that provides SentryService to all modules.
 * Import once in AppModule — available everywhere via DI.
 *
 * Usage:
 *   @Module({
 *     imports: [SentryModule],
 *   })
 *   export class AppModule {}
 *
 *   // In any service:
 *   constructor(private readonly sentry: SentryService) {}
 */

@Global()
@Module({
  providers: [SentryService],
  exports: [SentryService],
})
export class SentryModule {}
