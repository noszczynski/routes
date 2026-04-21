"use client";

import type { LatLngBoundsExpression } from "leaflet";
import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";

const PAN_OFFSET_PX = 120;

const isEditableTarget = (target: EventTarget | null) => {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	if (target.isContentEditable) {
		return true;
	}

	const tagName = target.tagName.toLowerCase();
	return tagName === "input" || tagName === "textarea" || tagName === "select";
};

export default function MapInteractionEnhancer({
	initialCenter,
	initialZoom,
	fitBounds,
}: {
	initialCenter: [number, number];
	initialZoom: number;
	fitBounds?: LatLngBoundsExpression;
}) {
	const map = useMap();

	useMapEvents({
		click() {
			map.getContainer().focus();
		},
	});

	useEffect(() => {
		map.scrollWheelZoom.enable();
		map.keyboard.enable();
		map.dragging.enable();
		map.doubleClickZoom.enable();
		map.boxZoom.enable();
		map.touchZoom.enable();

		const mapContainer = map.getContainer();
		mapContainer.tabIndex = 0;
		mapContainer.setAttribute(
			"aria-label",
			"Mapa. Kółko myszy powiększa i pomniejsza, strzałki przesuwają widok, plus i minus zmieniają przybliżenie.",
		);

		const handleKeyDown = (event: KeyboardEvent) => {
			if (isEditableTarget(event.target)) {
				return;
			}

			if (event.key === "+" || event.key === "=") {
				event.preventDefault();
				map.zoomIn();
				return;
			}

			if (event.key === "-" || event.key === "_") {
				event.preventDefault();
				map.zoomOut();
				return;
			}

			if (event.key === "0") {
				event.preventDefault();
				if (fitBounds) {
					map.fitBounds(fitBounds, { padding: [16, 16], maxZoom: 18 });
					return;
				}

				map.setView(initialCenter, initialZoom, { animate: true });
				return;
			}

			if (event.key === "ArrowUp") {
				event.preventDefault();
				map.panBy([0, -PAN_OFFSET_PX], { animate: true });
				return;
			}

			if (event.key === "ArrowDown") {
				event.preventDefault();
				map.panBy([0, PAN_OFFSET_PX], { animate: true });
				return;
			}

			if (event.key === "ArrowLeft") {
				event.preventDefault();
				map.panBy([-PAN_OFFSET_PX, 0], { animate: true });
				return;
			}

			if (event.key === "ArrowRight") {
				event.preventDefault();
				map.panBy([PAN_OFFSET_PX, 0], { animate: true });
			}
		};

		mapContainer.addEventListener("keydown", handleKeyDown);

		return () => {
			mapContainer.removeEventListener("keydown", handleKeyDown);
		};
	}, [map, fitBounds, initialCenter, initialZoom]);

	return null;
}
