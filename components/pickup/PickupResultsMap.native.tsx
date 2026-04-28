import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Colors } from "../../constants/color";
import type {
  PickupResultsMapHandle,
  PickupResultsMapProps,
} from "./PickupResultsMap.types";

const PickupResultsMap = forwardRef<PickupResultsMapHandle, PickupResultsMapProps>(
  function PickupResultsMap(
    { results, selectedPickupPoint, onMarkerSelect, height },
    ref,
  ) {
    const mapRef = useRef<MapView>(null);

    const pointsWithCoords = useMemo(
      () =>
        results.filter(
          (p) =>
            typeof p.latitude === "number" &&
            typeof p.longitude === "number" &&
            !Number.isNaN(p.latitude) &&
            !Number.isNaN(p.longitude),
        ),
      [results],
    );

    useImperativeHandle(
      ref,
      () => ({
        fitToResults() {
          if (!mapRef.current || pointsWithCoords.length === 0) return;
          const coords = pointsWithCoords.map((p) => ({
            latitude: p.latitude as number,
            longitude: p.longitude as number,
          }));
          if (coords.length === 1) {
            const c = coords[0]!;
            mapRef.current.animateToRegion(
              {
                latitude: c.latitude,
                longitude: c.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
              },
              0,
            );
            return;
          }
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 48, right: 32, bottom: 28, left: 32 },
            animated: true,
          });
        },
        focusOn(lat: number, lng: number) {
          mapRef.current?.animateToRegion(
            {
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.028,
              longitudeDelta: 0.028,
            },
            320,
          );
        },
      }),
      [pointsWithCoords],
    );

    useEffect(() => {
      if (pointsWithCoords.length === 0) return;
      const t = setTimeout(() => {
        if (!mapRef.current || pointsWithCoords.length === 0) return;
        const coords = pointsWithCoords.map((p) => ({
          latitude: p.latitude as number,
          longitude: p.longitude as number,
        }));
        if (coords.length === 1) {
          const c = coords[0]!;
          mapRef.current.animateToRegion(
            {
              latitude: c.latitude,
              longitude: c.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            },
            0,
          );
          return;
        }
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 48, right: 32, bottom: 28, left: 32 },
          animated: true,
        });
      }, 200);
      return () => clearTimeout(t);
    }, [pointsWithCoords]);

    if (pointsWithCoords.length === 0) return null;

    const first = pointsWithCoords[0]!;

    return (
      <View style={[styles.wrap, { height }]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: first.latitude as number,
            longitude: first.longitude as number,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
          loadingEnabled
          mapType="standard"
          showsCompass={false}
          showsPointsOfInterest={false}
          showsUserLocation
          showsMyLocationButton={false}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}
        >
          {pointsWithCoords.map((item) => {
            const selected = selectedPickupPoint?.id === item.id;
            return (
              <Marker
                key={item.id}
                coordinate={{
                  latitude: item.latitude as number,
                  longitude: item.longitude as number,
                }}
                tracksViewChanges={false}
                pinColor={selected ? Colors.primary[500] : Colors.neutral[400]}
                onPress={() => onMarkerSelect(item)}
              />
            );
          })}
        </MapView>
      </View>
    );
  },
);

export default PickupResultsMap;

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.neutral[100],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
});
