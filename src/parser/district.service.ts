import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

type Ring = [number, number][];
type Polygon = Ring[];

type District = {
    name: string;
    fallback: boolean;
    polygons: Polygon[];
    bbox: [number, number, number, number]; // minLng, minLat, maxLng, maxLat
};

/**
 * Определяет городской район Минска по координатам. Границы 8 районов
 * взяты из OSM через Nominatim; Партизанский район в OSM полигоном не
 * представлен, поэтому мы используем границу города как fallback: если
 * точка внутри Минска, но не попала ни в один из 8 — это Партизанский.
 */
@Injectable()
export class DistrictService implements OnModuleInit {
    private readonly logger = new Logger(DistrictService.name);
    private districts: District[] = [];

    onModuleInit() {
        const here = dirname(fileURLToPath(import.meta.url));
        const path = join(here, 'data', 'minsk-districts.geojson');
        const raw = JSON.parse(readFileSync(path, 'utf8')) as {
            features: {
                properties: { name: string; fallback?: boolean };
                geometry:
                    | { type: 'Polygon'; coordinates: number[][][] }
                    | { type: 'MultiPolygon'; coordinates: number[][][][] };
            }[];
        };

        this.districts = raw.features.map((f) => {
            const polygons: Polygon[] =
                f.geometry.type === 'Polygon'
                    ? [f.geometry.coordinates as unknown as Polygon]
                    : (f.geometry.coordinates as unknown as Polygon[]);
            const bbox = this.computeBbox(polygons);
            return {
                name: f.properties.name,
                fallback: f.properties.fallback === true,
                polygons,
                bbox,
            };
        });

        this.logger.log(`Загружено ${this.districts.length} районов Минска`);
    }

    resolveByCoords(lat: number | null, lng: number | null): string | null {
        if (lat == null || lng == null) return null;

        // Сначала пробуем 8 «настоящих» районов, потом fallback (Партизанский).
        for (const d of this.districts) {
            if (d.fallback) continue;
            if (this.contains(d, lng, lat)) return d.name;
        }
        for (const d of this.districts) {
            if (!d.fallback) continue;
            if (this.contains(d, lng, lat)) return d.name;
        }
        return null;
    }

    private contains(d: District, lng: number, lat: number): boolean {
        // Быстрая отсечка по bbox — экономит 90%+ на карте с ~7к объектов.
        if (lng < d.bbox[0] || lng > d.bbox[2] || lat < d.bbox[1] || lat > d.bbox[3]) return false;
        for (const poly of d.polygons) {
            if (this.pointInPolygon(lng, lat, poly)) return true;
        }
        return false;
    }

    // Ray casting: точка внутри полигона, если луч вправо пересекает
    // нечётное число рёбер (учитывая дыры — они инвертируют результат).
    private pointInPolygon(x: number, y: number, poly: Polygon): boolean {
        let inside = false;
        for (const ring of poly) {
            if (this.pointInRing(x, y, ring)) inside = !inside;
        }
        return inside;
    }

    private pointInRing(x: number, y: number, ring: Ring): boolean {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], yi = ring[i][1];
            const xj = ring[j][0], yj = ring[j][1];
            const intersect =
                yi > y !== yj > y &&
                x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
        }
        return inside;
    }

    private computeBbox(polygons: Polygon[]): [number, number, number, number] {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        for (const poly of polygons) {
            for (const ring of poly) {
                for (const [lng, lat] of ring) {
                    if (lng < minLng) minLng = lng;
                    if (lng > maxLng) maxLng = lng;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                }
            }
        }
        return [minLng, minLat, maxLng, maxLat];
    }
}
