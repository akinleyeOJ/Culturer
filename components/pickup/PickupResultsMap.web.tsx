import React, { forwardRef, useImperativeHandle } from "react";
import type {
  PickupResultsMapHandle,
  PickupResultsMapProps,
} from "./PickupResultsMap.types";

/** react-native-maps is native-only; map UI is skipped on web. */
const PickupResultsMap = forwardRef<PickupResultsMapHandle, PickupResultsMapProps>(
  function PickupResultsMap(_props, ref) {
    useImperativeHandle(ref, () => ({
      fitToResults: () => {},
      focusOn: () => {},
    }));
    return null;
  },
);

export default PickupResultsMap;
