// Prefer Google placeId; else normalized name+short address; else ~5dp coordinates.
export const stablePlaceKey = (p: any): string => {
    const safe = (s: any) => String(s ?? '').trim().toLowerCase();
    const pid = safe(p?.placeId ?? p?.place_id);
    if (pid) return `pid:${pid}`;
    const lat = p?.coordinates?.lat;
    const lng = p?.coordinates?.lng;
    const byCoords = (typeof lat === 'number' && typeof lng === 'number')
        ? `geo:${lat.toFixed(5)},${lng.toFixed(5)}`
        : '';
    const name = safe(p?.name);
    const addrRaw = p?.address ?? p?.formattedAddress ?? '';
    const addr = safe(addrRaw).split(',')[0].replace(/\d+\s+/g, '');
    if (name && addr) return `loc:${name.substring(0,20)}|${addr.substring(0,30)}`;
    if (name) return `loc:${name.substring(0,20)}`;
    return byCoords;
};
