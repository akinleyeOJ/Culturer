import type { PickupPointResult, PickupPointSearchContext } from './services/pickupPointService';

export interface PickupPointSelectionState {
    carrierName: string | null;
    selection: PickupPointResult | null;
    search: string;
    context: PickupPointSearchContext | null;
}

let state: PickupPointSelectionState = {
    carrierName: null,
    selection: null,
    search: '',
    context: null,
};

export const getPickupPointSelectionState = () => state;

export const setPickupPointSelectionState = (next: PickupPointSelectionState) => {
    state = next;
};

export const clearPickupPointSelectionState = () => {
    state = {
        carrierName: null,
        selection: null,
        search: '',
        context: null,
    };
};
