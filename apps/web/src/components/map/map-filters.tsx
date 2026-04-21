"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@routes/ui/components/card";
import { Input } from "@routes/ui/components/input";
import { Label } from "@routes/ui/components/label";

type MapFiltersValue = {
	minDistance?: number;
	maxDistance?: number;
	minElevationGain?: number;
	maxElevationGain?: number;
};

const toNumber = (value: string) => {
	if (!value) {
		return undefined;
	}

	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : undefined;
};

export default function MapFilters({
	filters,
	onChange,
}: {
	filters: MapFiltersValue;
	onChange: (filters: MapFiltersValue) => void;
}) {
	return (
		<div className="absolute top-4 left-4 z-[500] w-80 max-w-[calc(100%-2rem)]">
			<Card>
				<CardHeader>
					<CardTitle>Filtry</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3">
					<div className="grid gap-2">
						<Label htmlFor="min-distance">Dystans od (km)</Label>
						<Input
							id="min-distance"
							type="number"
							min="0"
							value={filters.minDistance ?? ""}
							onChange={(event) =>
								onChange({
									...filters,
									minDistance: toNumber(event.target.value),
								})
							}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="max-distance">Dystans do (km)</Label>
						<Input
							id="max-distance"
							type="number"
							min="0"
							value={filters.maxDistance ?? ""}
							onChange={(event) =>
								onChange({
									...filters,
									maxDistance: toNumber(event.target.value),
								})
							}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="min-elevation">Przewyższenie od (m)</Label>
						<Input
							id="min-elevation"
							type="number"
							min="0"
							value={filters.minElevationGain ?? ""}
							onChange={(event) =>
								onChange({
									...filters,
									minElevationGain: toNumber(event.target.value),
								})
							}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="max-elevation">Przewyższenie do (m)</Label>
						<Input
							id="max-elevation"
							type="number"
							min="0"
							value={filters.maxElevationGain ?? ""}
							onChange={(event) =>
								onChange({
									...filters,
									maxElevationGain: toNumber(event.target.value),
								})
							}
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
