import { IsIn } from "class-validator";
import { UI_LANGUAGES, type UiLanguage } from "@creator-hub/shared-types";

/** Body of PATCH /auth/preferences. */
export class UpdatePreferencesDto {
  /** Interface language of the web app. */
  @IsIn(UI_LANGUAGES)
  preferredLanguage!: UiLanguage;
}
