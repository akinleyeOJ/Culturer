import type { PickupPointResult } from "../../lib/services/pickupPointService";

export type PickupResultsMapHandle = {
  fitToResults: () => void;
  focusOn: (lat: number, lng: number) => void;
};

export type PickupResultsMapProps = {
  results: PickupPointResult[];
  selectedPickupPoint: PickupPointResult | null;
  onMarkerSelect: (item: PickupPointResult) => void;
  height: number;
};
