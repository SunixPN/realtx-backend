// Человекочитаемое описание набора фильтров подписки для показа на
// карточке. Возвращает `summary` (одна строка) и `chips` (короткие
// теги). Единый источник правды — фронт может отображать как есть.

const CURRENCY_LABEL: Record<number, string> = {
    840: '$',
    933: 'Br',
    978: '€',
};

const WALL_MATERIAL_LABEL: Record<number, string> = {
    1: 'панель',
    2: 'кирпич',
    3: 'блок',
    4: 'монолит',
    5: 'дерево',
};

const REPAIR_STATE_LABEL: Record<number, string> = {
    1: 'без ремонта',
    2: 'косметический',
    3: 'евроремонт',
    4: 'дизайнерский',
};

type Filters = Record<string, unknown>;

function fmtNumber(n: number): string {
    return n.toLocaleString('ru-RU');
}

function pickString(f: Filters, key: string): string | undefined {
    const v = f[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function pickNumber(f: Filters, key: string): number | undefined {
    const v = f[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function pickBool(f: Filters, key: string): boolean {
    return f[key] === true;
}

function pickNumberArray(f: Filters, key: string): number[] {
    const v = f[key];
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
}

function pickStringArray(f: Filters, key: string): string[] {
    const v = f[key];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function describeFilters(filters: Filters): { summary: string; chips: string[] } {
    const chips: string[] = [];

    const rooms = pickNumberArray(filters, 'rooms');
    if (rooms.length) {
        const sorted = [...rooms].sort((a, b) => a - b);
        const parts = sorted.map(r => r >= 5 ? '5+' : String(r));
        chips.push(`${parts.join('/')} комн.`);
    }

    const priceMin = pickNumber(filters, 'priceMin');
    const priceMax = pickNumber(filters, 'priceMax');
    if (priceMin !== undefined || priceMax !== undefined) {
        const currency = pickNumber(filters, 'displayCurrency') ?? 840;
        const sym = CURRENCY_LABEL[currency] ?? '';
        if (priceMin !== undefined && priceMax !== undefined) {
            chips.push(`${fmtNumber(priceMin)}–${fmtNumber(priceMax)} ${sym}`);
        } else if (priceMin !== undefined) {
            chips.push(`от ${fmtNumber(priceMin)} ${sym}`);
        } else if (priceMax !== undefined) {
            chips.push(`до ${fmtNumber(priceMax)} ${sym}`);
        }
    }

    const areaMin = pickNumber(filters, 'areaMin');
    const areaMax = pickNumber(filters, 'areaMax');
    if (areaMin !== undefined && areaMax !== undefined) {
        chips.push(`${areaMin}–${areaMax} м²`);
    } else if (areaMin !== undefined) {
        chips.push(`от ${areaMin} м²`);
    } else if (areaMax !== undefined) {
        chips.push(`до ${areaMax} м²`);
    }

    const districts = pickStringArray(filters, 'districts');
    if (districts.length === 1) chips.push(districts[0]);
    else if (districts.length > 1) chips.push(`${districts.length} районов`);

    const metroTimeMax = pickNumber(filters, 'metroTimeMax');
    if (metroTimeMax !== undefined) chips.push(`до метро ${metroTimeMax} мин`);

    if (pickBool(filters, 'notFirstOrLast')) chips.push('не первый и не последний этаж');
    if (pickBool(filters, 'ownerOnly')) chips.push('только собственники');

    const storeyMin = pickNumber(filters, 'storeyMin');
    const storeyMax = pickNumber(filters, 'storeyMax');
    if (storeyMin !== undefined && storeyMax !== undefined) {
        chips.push(`этаж ${storeyMin}–${storeyMax}`);
    } else if (storeyMin !== undefined) {
        chips.push(`этаж от ${storeyMin}`);
    } else if (storeyMax !== undefined) {
        chips.push(`этаж до ${storeyMax}`);
    }

    const buildingYearMin = pickNumber(filters, 'buildingYearMin');
    const buildingYearMax = pickNumber(filters, 'buildingYearMax');
    if (buildingYearMin !== undefined && buildingYearMax !== undefined) {
        chips.push(`${buildingYearMin}–${buildingYearMax} г.`);
    } else if (buildingYearMin !== undefined) {
        chips.push(`с ${buildingYearMin} г.`);
    } else if (buildingYearMax !== undefined) {
        chips.push(`до ${buildingYearMax} г.`);
    }

    const walls = pickNumberArray(filters, 'wallMaterial')
        .map(m => WALL_MATERIAL_LABEL[m])
        .filter(Boolean);
    if (walls.length) chips.push(walls.join(', '));

    const repair = pickNumberArray(filters, 'repairState')
        .map(m => REPAIR_STATE_LABEL[m])
        .filter(Boolean);
    if (repair.length) chips.push(repair.join(', '));

    const q = pickString(filters, 'q');
    if (q) chips.push(`«${q}»`);

    const summary = chips.length ? chips.join(' · ') : 'Все объявления';
    return { summary, chips };
}
