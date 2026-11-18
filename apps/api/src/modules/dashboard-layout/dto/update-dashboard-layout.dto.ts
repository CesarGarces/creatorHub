import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  DASHBOARD_WIDGET_IDS,
  type DashboardWidgetId,
} from "@creator-hub/shared-types";

/** One widget of the layout; its place is its index in the list. */
export class DashboardWidgetStateDto {
  @IsIn(DASHBOARD_WIDGET_IDS)
  id!: DashboardWidgetId;

  @IsBoolean()
  visible!: boolean;
}

/**
 * Body of PUT /user/dashboard-layout: the widgets in display order.
 * Widgets left out keep their default visibility at the end (the service
 * normalizes), so older clients can't break a newer layout.
 */
export class UpdateDashboardLayoutDto {
  @IsArray()
  @ArrayMaxSize(DASHBOARD_WIDGET_IDS.length)
  @ArrayUnique((widget: DashboardWidgetStateDto | undefined) => widget?.id)
  @ValidateNested({ each: true })
  @Type(() => DashboardWidgetStateDto)
  widgets!: DashboardWidgetStateDto[];
}
